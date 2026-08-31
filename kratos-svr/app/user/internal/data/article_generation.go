package data

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"sort"
	"strconv"
	"strings"
	"text/template"
	"time"

	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/data/model"

	"github.com/yuin/goldmark"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const maxGenerationKnowledgeRunes = 80000

type articleGenerationRepo struct {
	data    *Data
	storage *FileStorage
}

type generationPromptSnapshot struct {
	System string `json:"system"`
	User   string `json:"user"`
	Brand  string `json:"brand,omitempty"`
}

type generationModelSnapshot struct {
	Provider                          string  `json:"provider"`
	Protocol                          string  `json:"protocol"`
	BaseURL                           string  `json:"base_url"`
	ModelID                           string  `json:"model_id"`
	Temperature                       float64 `json:"temperature"`
	TopP                              float64 `json:"top_p"`
	MaxTokens                         uint32  `json:"max_tokens"`
	TimeoutSeconds                    uint32  `json:"timeout_seconds"`
	InputPriceMicrosPerMillionTokens  int64   `json:"input_price_micros_per_million_tokens"`
	OutputPriceMicrosPerMillionTokens int64   `json:"output_price_micros_per_million_tokens"`
	PriceCurrency                     string  `json:"price_currency"`
	Version                           uint64  `json:"version"`
}

type generationInputSnapshot struct {
	BrandID              uint64         `json:"brand_id"`
	KeywordID            uint64         `json:"keyword_id,omitempty"`
	QuestionID           uint64         `json:"question_id,omitempty"`
	KnowledgeBaseIDs     []uint64       `json:"knowledge_base_ids,omitempty"`
	KnowledgeDocumentIDs []uint64       `json:"knowledge_document_ids,omitempty"`
	GalleryAlbumIDs      []uint64       `json:"gallery_album_ids,omitempty"`
	GalleryImageCount    uint32         `json:"gallery_image_count,omitempty"`
	Variables            map[string]any `json:"variables"`
	UserInstruction      string         `json:"user_instruction,omitempty"`
	OperatorID           uint64         `json:"operator_id"`
}

type generationKnowledgeRef struct {
	KnowledgeBaseID uint64 `json:"knowledge_base_id"`
	Category        int32  `json:"category"`
	DocumentID      uint64 `json:"document_id"`
	DocumentVersion uint32 `json:"document_version"`
	ChunkID         uint64 `json:"chunk_id"`
	ChunkIndex      uint32 `json:"chunk_index"`
	Title           string `json:"title"`
}

type generationKnowledgeRow struct {
	KnowledgeBaseID uint64
	Category        int32
	DocumentID      uint64
	DocumentVersion uint32
	ChunkID         uint64
	ChunkIndex      uint32
	Title           string
	Content         string
}

func NewArticleGenerationRepo(data *Data, storage *FileStorage) biz.ArticleGenerationRepo {
	return &articleGenerationRepo{data: data, storage: storage}
}

func (r *articleGenerationRepo) Create(ctx context.Context, input biz.ArticleGenerationInput) (*biz.ArticleGenerationTask, bool, error) {
	var task model.ArticleGenerationTask
	created := false
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		query := tx.Where("enterprise_id = ? AND client_request_id = ?", input.EnterpriseID, strings.TrimSpace(input.ClientRequestID)).First(&task)
		if query.Error == nil {
			return nil
		}
		if !errors.Is(query.Error, gorm.ErrRecordNotFound) {
			return query.Error
		}

		var brand model.Brand
		if err := tx.Where("enterprise_id = ? AND id = ?", input.EnterpriseID, input.BrandID).First(&brand).Error; err != nil {
			return mapBrandError(err)
		}
		if input.ArticleID != 0 {
			var article model.Article
			if err := tx.Select("id", "brand_id", "status").Where("enterprise_id = ? AND id = ?", input.EnterpriseID, input.ArticleID).First(&article).Error; err != nil {
				return mapArticleError(err)
			}
			if article.BrandID != input.BrandID || (article.Status != "draft" && article.Status != "rejected") {
				return biz.ErrArticleState
			}
		}

		articleTypeVersion, err := resolveArticleTypeVersion(tx, input)
		if err != nil {
			return biz.ErrArticleGenerationInvalid
		}
		systemPrompt, userPromptTemplate, promptVersionID, err := resolveArticleTypePrompt(tx, articleTypeVersion)
		if err != nil {
			return err
		}
		writingModelID, err := resolveArticleTypeWritingModel(articleTypeVersion, input.WritingModelID)
		if err != nil {
			return err
		}
		var writingModel model.WritingModel
		if err := tx.Model(&model.WritingModel{}).
			Where(model.TableWritingModels+".id = ? AND "+model.TableWritingModels+".status = ?", writingModelID, model.WritingModelStatusActive).
			Where(writingModelAccessSQL, writingModelAccessArgs(input.EnterpriseID)...).
			First(&writingModel).Error; err != nil {
			return biz.ErrArticleGenerationModel
		}

		var variables map[string]any
		if err := json.Unmarshal([]byte(input.InputJSON), &variables); err != nil {
			return biz.ErrArticleGenerationInvalid
		}
		if err := validateGenerationVariables(articleTypeVersion.InputFields, variables); err != nil {
			return err
		}
		if err := addGenerationQuestionContext(tx, input, variables); err != nil {
			return err
		}
		knowledgeContext, knowledgeRefs, err := r.loadKnowledgeContext(
			tx,
			input.EnterpriseID,
			input.KnowledgeBaseIDs,
			input.KnowledgeDocumentIDs,
		)
		if err != nil {
			return err
		}
		galleryRefs, err := r.selectGalleryImages(tx, input)
		if err != nil {
			return err
		}
		promptSnapshot, err := buildGenerationPrompt(systemPrompt, userPromptTemplate, articleTypeVersion, brand, variables, knowledgeContext, galleryRefs, input.UserInstruction)
		if err != nil {
			return fmt.Errorf("build generation prompt: %w", err)
		}
		promptJSON, err := json.Marshal(promptSnapshot)
		if err != nil {
			return err
		}
		modelJSON, err := json.Marshal(generationModelSnapshot{
			Provider: writingModelProviderCode(writingModel.Provider), Protocol: writingModelProtocolCode(writingModel.Protocol), BaseURL: writingModel.BaseURL,
			ModelID: writingModel.ModelID, Temperature: writingModel.Temperature, TopP: writingModel.TopP,
			MaxTokens: writingModel.MaxTokens, TimeoutSeconds: writingModel.TimeoutSeconds,
			InputPriceMicrosPerMillionTokens:  writingModel.InputPriceMicrosPerMillionTokens,
			OutputPriceMicrosPerMillionTokens: writingModel.OutputPriceMicrosPerMillionTokens,
			PriceCurrency:                     priceCurrencyCode(writingModel.PriceCurrency), Version: writingModel.Version,
		})
		if err != nil {
			return err
		}
		inputJSON, err := json.Marshal(generationInputSnapshot{
			BrandID:              input.BrandID,
			KeywordID:            input.KeywordID,
			QuestionID:           input.QuestionID,
			KnowledgeBaseIDs:     input.KnowledgeBaseIDs,
			KnowledgeDocumentIDs: input.KnowledgeDocumentIDs,
			GalleryAlbumIDs:      input.GalleryAlbumIDs,
			GalleryImageCount:    input.GalleryImageCount,
			Variables:            variables,
			UserInstruction:      input.UserInstruction,
			OperatorID:           input.OperatorID,
		})
		if err != nil {
			return err
		}
		galleryRefsJSON, err := json.Marshal(galleryRefs)
		if err != nil {
			return err
		}
		knowledgeRefsJSON, err := json.Marshal(knowledgeRefs)
		if err != nil {
			return err
		}

		task = model.ArticleGenerationTask{
			TenantModel:          model.TenantModel{EnterpriseID: input.EnterpriseID},
			ArticleTypeVersionID: articleTypeVersion.ID,
			PromptVersionID:      promptVersionID,
			WritingModelID:       writingModelID,
			WritingModelVersion:  writingModel.Version,
			ClientRequestID:      strings.TrimSpace(input.ClientRequestID),
			Status:               "pending",
			InputJSON:            inputJSON,
			PromptSnapshot:       string(promptJSON),
			ModelSnapshotJSON:    modelJSON,
			KnowledgeRefsJSON:    knowledgeRefsJSON,
			GalleryRefsJSON:      galleryRefsJSON,
		}
		if input.ArticleID != 0 {
			task.ArticleID = &input.ArticleID
		}
		if err := tx.Create(&task).Error; err != nil {
			if errors.Is(err, gorm.ErrDuplicatedKey) {
				return tx.Where("enterprise_id = ? AND client_request_id = ?", input.EnterpriseID, strings.TrimSpace(input.ClientRequestID)).First(&task).Error
			}
			return err
		}
		// 计费：双账本预扣（额度优先，额度用尽自动转点数扣减）。
		idemKey := "article-generation:" + strings.TrimSpace(input.ClientRequestID)
		if _, err := reserveBilling(tx, input.EnterpriseID, "article_generation", 1, "article_generation", task.ID, idemKey, "article generation created"); err != nil {
			return err
		}
		created = true
		return nil
	})
	if err != nil {
		return nil, false, mapArticleGenerationError(err)
	}
	return articleGenerationDO(&task), created, nil
}

func (r *articleGenerationRepo) Get(ctx context.Context, enterpriseID, id uint64) (*biz.ArticleGenerationTask, error) {
	var task model.ArticleGenerationTask
	if err := r.data.DB(ctx).Where("enterprise_id = ? AND id = ?", enterpriseID, id).First(&task).Error; err != nil {
		return nil, mapArticleGenerationError(err)
	}
	return articleGenerationDO(&task), nil
}

func (r *articleGenerationRepo) List(ctx context.Context, enterpriseID uint64, opts biz.ArticleGenerationListOptions) ([]*biz.ArticleGenerationTask, int64, error) {
	db := r.data.DB(ctx).Model(&model.ArticleGenerationTask{}).Where("enterprise_id = ?", enterpriseID)
	if opts.Status != "" {
		db = db.Where("status = ?", opts.Status)
	}
	if opts.ArticleID != 0 {
		db = db.Where("article_id = ?", opts.ArticleID)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []model.ArticleGenerationTask
	if err := db.Order("created_at DESC, id DESC").Offset(opts.Offset).Limit(opts.Limit).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	items := make([]*biz.ArticleGenerationTask, 0, len(rows))
	for i := range rows {
		items = append(items, articleGenerationDO(&rows[i]))
	}
	return items, total, nil
}

func (r *articleGenerationRepo) Start(ctx context.Context, enterpriseID, id uint64, retry bool) (*biz.ArticleGenerationTask, error) {
	expectedStatus := "pending"
	if retry {
		expectedStatus = "failed"
	}
	now := time.Now().UTC()
	result := r.data.DB(ctx).Model(&model.ArticleGenerationTask{}).
		Where("enterprise_id = ? AND id = ? AND status = ?", enterpriseID, id, expectedStatus).
		Updates(map[string]any{
			"status":        "running",
			"started_at":    now,
			"completed_at":  nil,
			"error_code":    "",
			"error_message": "",
			"attempt_count": gorm.Expr("attempt_count + 1"),
		})
	if result.Error != nil {
		return nil, mapArticleGenerationError(result.Error)
	}
	if result.RowsAffected != 1 {
		return nil, biz.ErrArticleGenerationState
	}
	return r.Get(ctx, enterpriseID, id)
}

func (r *articleGenerationRepo) Complete(ctx context.Context, task *biz.ArticleGenerationTask, result *biz.ArticleGenerationResult) (*biz.ArticleGenerationTask, error) {
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var currentTask model.ArticleGenerationTask
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("enterprise_id = ? AND id = ? AND status = ?", task.EnterpriseID, task.ID, "running").
			First(&currentTask).Error; err != nil {
			return err
		}
		var input generationInputSnapshot
		if err := json.Unmarshal(currentTask.InputJSON, &input); err != nil {
			return err
		}
		var articleTypeVersion model.ArticleTypeVersion
		if err := tx.Select("article_type_id").First(&articleTypeVersion, currentTask.ArticleTypeVersionID).Error; err != nil {
			return err
		}

		article, articleVersion, err := completeGeneratedArticle(tx, &currentTask, articleTypeVersion.ArticleTypeID, input, result)
		if err != nil {
			return err
		}
		if err := bindArticleGalleryImages(tx, currentTask.EnterpriseID, article.ID, currentTask.GalleryRefsJSON); err != nil {
			return err
		}
		snapshot := model.ArticleSnapshot{
			ImmutableTenantModel: model.ImmutableTenantModel{EnterpriseID: currentTask.EnterpriseID},
			ArticleID:            article.ID,
			ArticleVersionID:     articleVersion.ID,
			ArticleTypeVersionID: &currentTask.ArticleTypeVersionID,
			PromptVersionID:      currentTask.PromptVersionID,
			WritingModelID:       &currentTask.WritingModelID,
			Title:                result.Title,
			ContentMarkdown:      result.ContentMarkdown,
			ContentHTML:          articleVersion.ContentHTML,
			InputSnapshotJSON:    currentTask.InputJSON,
			KnowledgeRefsJSON:    currentTask.KnowledgeRefsJSON,
			GalleryRefsJSON:      currentTask.GalleryRefsJSON,
			ContentHash:          contentHash(result.Title, result.ContentMarkdown, articleVersion.ContentHTML),
		}
		if err := tx.Create(&snapshot).Error; err != nil {
			return err
		}
		if err := tx.Model(article).Updates(map[string]any{
			"current_version_id": articleVersion.ID,
			"latest_snapshot_id": snapshot.ID,
		}).Error; err != nil {
			return err
		}
		outputJSON, err := json.Marshal(result)
		if err != nil {
			return err
		}
		now := time.Now().UTC()
		if err := tx.Model(&currentTask).Updates(map[string]any{
			"article_id":                article.ID,
			"status":                    "completed",
			"output_json":               outputJSON,
			"input_tokens":              result.InputTokens,
			"output_tokens":             result.OutputTokens,
			"cost_micros":               result.CostMicros,
			"result_article_version_id": articleVersion.ID,
			"result_snapshot_id":        snapshot.ID,
			"completed_at":              now,
		}).Error; err != nil {
			return err
		}
		// 计费：任务成功，结算预扣（额度或点数，由 settleBillingByRef 自动判断）。
		settleKey := fmt.Sprintf("article-generation-settle:%d", currentTask.ID)
		return settleBillingByRef(tx, currentTask.EnterpriseID, "article_generations", 1, "article_generation", currentTask.ID, settleKey)
	})
	if err != nil {
		return nil, mapArticleGenerationError(err)
	}
	return r.Get(ctx, task.EnterpriseID, task.ID)
}

func (r *articleGenerationRepo) Fail(ctx context.Context, enterpriseID, id uint64, code, message string) (*biz.ArticleGenerationTask, error) {
	now := time.Now().UTC()
	var task model.ArticleGenerationTask
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("enterprise_id = ? AND id = ? AND status = ?", enterpriseID, id, "running").
			First(&task).Error; err != nil {
			return err
		}
		if err := tx.Model(&task).Updates(map[string]any{
			"status":        "failed",
			"error_code":    code,
			"error_message": message,
			"completed_at":  now,
		}).Error; err != nil {
			return err
		}
		// 计费：任务失败，回滚预扣（额度或点数，由 rollbackBillingByRef 自动判断）。
		rollbackKey := fmt.Sprintf("article-generation-rollback:%d", id)
		return rollbackBillingByRef(tx, enterpriseID, "article_generations", 1, "article_generation", id, rollbackKey)
	})
	if err != nil {
		return nil, mapArticleGenerationError(err)
	}
	return r.Get(ctx, enterpriseID, id)
}

func (r *articleGenerationRepo) loadKnowledgeContext(
	tx *gorm.DB,
	enterpriseID uint64,
	baseIDs []uint64,
	documentIDs []uint64,
) (string, []generationKnowledgeRef, error) {
	if len(baseIDs) == 0 && len(documentIDs) == 0 {
		return "", nil, nil
	}
	if len(documentIDs) == 0 {
		var baseCount int64
		if err := tx.Model(&model.KnowledgeBase{}).
			Where("enterprise_id = ? AND id IN ? AND status = ?", enterpriseID, baseIDs, biz.KnowledgeBaseStatusActive).
			Count(&baseCount).Error; err != nil {
			return "", nil, err
		}
		if baseCount != int64(len(baseIDs)) {
			return "", nil, biz.ErrKnowledgeBaseNotFound
		}
	} else {
		var documentCount int64
		if err := tx.Table(model.TableKnowledgeDocuments+" AS document").
			Joins("JOIN "+model.TableKnowledgeBases+" AS base ON base.id = document.knowledge_base_id AND base.enterprise_id = document.enterprise_id AND base.deleted_at IS NULL AND base.status = ?", biz.KnowledgeBaseStatusActive).
			Where("document.enterprise_id = ? AND document.id IN ? AND document.deleted_at IS NULL AND document.parse_status = ?", enterpriseID, documentIDs, biz.KnowledgeParseStatusParsed).
			Count(&documentCount).Error; err != nil {
			return "", nil, err
		}
		if documentCount != int64(len(documentIDs)) {
			return "", nil, biz.ErrArticleGenerationKnowledge
		}
	}
	var rows []generationKnowledgeRow
	query := tx.Table(model.TableKnowledgeChunks+" AS chunk").
		Select("base.id AS knowledge_base_id, document.category, document.id AS document_id, document.document_version, chunk.id AS chunk_id, chunk.chunk_index, document.title, chunk.content").
		Joins("JOIN "+model.TableKnowledgeDocuments+" AS document ON document.id = chunk.knowledge_document_id AND document.enterprise_id = chunk.enterprise_id AND document.deleted_at IS NULL AND document.parse_status = ? AND document.document_version = chunk.document_version", biz.KnowledgeParseStatusParsed).
		Joins("JOIN "+model.TableKnowledgeBases+" AS base ON base.id = document.knowledge_base_id AND base.enterprise_id = document.enterprise_id AND base.deleted_at IS NULL AND base.status = ?", biz.KnowledgeBaseStatusActive).
		Where("chunk.enterprise_id = ?", enterpriseID)
	if len(documentIDs) > 0 {
		query = query.Where("document.id IN ?", documentIDs)
	} else {
		query = query.Where("base.id IN ?", baseIDs)
	}
	err := query.
		Order("document.category ASC, document.id ASC, chunk.chunk_index ASC").
		Limit(200).
		Scan(&rows).Error
	if err != nil {
		return "", nil, err
	}
	if len(rows) == 0 {
		return "", nil, biz.ErrArticleGenerationKnowledge
	}
	var builder strings.Builder
	usedRunes := 0
	refs := make([]generationKnowledgeRef, 0, len(rows))
	for _, row := range rows {
		remaining := maxGenerationKnowledgeRunes - usedRunes
		if remaining <= 0 {
			break
		}
		contentRunes := []rune(row.Content)
		if len(contentRunes) > remaining {
			contentRunes = contentRunes[:remaining]
		}
		fmt.Fprintf(
			&builder,
			"\n[分类:%s 资料:%s 文档%d 分块%d]\n%s\n",
			biz.KnowledgeCategoryLabel(row.Category),
			row.Title,
			row.DocumentID,
			row.ChunkIndex,
			string(contentRunes),
		)
		usedRunes += len(contentRunes)
		refs = append(refs, generationKnowledgeRef{
			KnowledgeBaseID: row.KnowledgeBaseID,
			Category:        row.Category,
			DocumentID:      row.DocumentID,
			DocumentVersion: row.DocumentVersion,
			ChunkID:         row.ChunkID,
			ChunkIndex:      row.ChunkIndex,
			Title:           row.Title,
		})
	}
	return builder.String(), refs, nil
}

func (r *articleGenerationRepo) selectGalleryImages(tx *gorm.DB, input biz.ArticleGenerationInput) ([]biz.ArticleGenerationGalleryRef, error) {
	if len(input.GalleryAlbumIDs) == 0 {
		return nil, nil
	}
	var albums []model.GalleryAlbum
	if err := tx.Select("id", "name", "category").
		Where("enterprise_id = ? AND id IN ?", input.EnterpriseID, input.GalleryAlbumIDs).
		Find(&albums).Error; err != nil {
		return nil, err
	}
	if len(albums) != len(input.GalleryAlbumIDs) {
		return nil, biz.ErrArticleGenerationGallery
	}
	if input.GalleryImageCount == 0 {
		return nil, nil
	}

	albumByID := make(map[uint64]model.GalleryAlbum, len(albums))
	for _, album := range albums {
		albumByID[album.ID] = album
	}
	var images []model.GalleryImage
	if err := tx.Select("id", "album_id", "original_name", "object_key").
		Where("enterprise_id = ? AND album_id IN ?", input.EnterpriseID, input.GalleryAlbumIDs).
		Order("id ASC").
		Find(&images).Error; err != nil {
		return nil, err
	}
	if len(images) < int(input.GalleryImageCount) {
		return nil, biz.ErrArticleGenerationGallery
	}
	type scoredImage struct {
		image model.GalleryImage
		score [sha256.Size]byte
	}
	scored := make([]scoredImage, 0, len(images))
	for _, image := range images {
		score := sha256.Sum256([]byte(fmt.Sprintf("%s:%d", strings.TrimSpace(input.ClientRequestID), image.ID)))
		scored = append(scored, scoredImage{image: image, score: score})
	}
	sort.Slice(scored, func(i, j int) bool {
		return bytes.Compare(scored[i].score[:], scored[j].score[:]) < 0
	})
	refs := make([]biz.ArticleGenerationGalleryRef, 0, input.GalleryImageCount)
	for index, item := range scored[:input.GalleryImageCount] {
		album := albumByID[item.image.AlbumID]
		publicURL := r.storage.PublicURL(item.image.ObjectKey)
		if strings.TrimSpace(publicURL) == "" {
			return nil, biz.ErrArticleGenerationGallery
		}
		placement := int32(biz.ArticleGalleryPlacementBody)
		placeholder := fmt.Sprintf("[[GALLERY_IMAGE_%d]]", index)
		if index == 0 {
			placement = biz.ArticleGalleryPlacementCover
			placeholder = ""
		}
		refs = append(refs, biz.ArticleGenerationGalleryRef{
			ImageID:      item.image.ID,
			AlbumID:      album.ID,
			AlbumName:    album.Name,
			Category:     album.Category,
			OriginalName: item.image.OriginalName,
			ObjectKey:    item.image.ObjectKey,
			URL:          publicURL,
			Placeholder:  placeholder,
			Placement:    placement,
		})
	}
	return refs, nil
}

func resolveArticleTypeVersion(tx *gorm.DB, input biz.ArticleGenerationInput) (*model.ArticleTypeVersion, error) {
	versionID := input.ArticleTypeVersionID
	if input.ArticleTypeID != 0 {
		var articleType model.ArticleType
		if err := tx.Select("id", "current_version_id").Where("id = ? AND status = ? AND visible = ?", input.ArticleTypeID, model.ArticleTypeStatusActive, true).First(&articleType).Error; err != nil || articleType.CurrentVersionID == nil {
			return nil, biz.ErrArticleGenerationInvalid
		}
		versionID = *articleType.CurrentVersionID
	}
	var version model.ArticleTypeVersion
	query := tx.
		Preload("Sections", func(query *gorm.DB) *gorm.DB { return query.Order("sort_order ASC") }).
		Preload("InputFields", func(query *gorm.DB) *gorm.DB { return query.Order("sort_order ASC") }).
		Preload("InputFields.Options", func(query *gorm.DB) *gorm.DB { return query.Order("sort_order ASC") }).
		Preload("Rules", func(query *gorm.DB) *gorm.DB { return query.Order("rule_type ASC, sort_order ASC") }).
		Preload("Models", func(query *gorm.DB) *gorm.DB { return query.Order("sort_order ASC") })
	if err := query.Where("id = ? AND status = ?", versionID, model.ArticleTypeVersionStatusPublished).First(&version).Error; err != nil {
		return nil, biz.ErrArticleGenerationInvalid
	}
	return &version, nil
}

func resolveArticleTypePrompt(tx *gorm.DB, version *model.ArticleTypeVersion) (string, string, *uint64, error) {
	if strings.TrimSpace(version.SystemPrompt) != "" && strings.TrimSpace(version.UserPromptTemplate) != "" {
		return version.SystemPrompt, version.UserPromptTemplate, version.PromptVersionID, nil
	}
	if version.PromptVersionID == nil {
		return "", "", nil, biz.ErrArticleGenerationInvalid
	}
	var prompt model.PromptVersion
	if err := tx.Where("id = ? AND status = ?", *version.PromptVersionID, "published").First(&prompt).Error; err != nil {
		return "", "", nil, biz.ErrArticleGenerationInvalid
	}
	return prompt.SystemPrompt, prompt.Template, version.PromptVersionID, nil
}

func resolveArticleTypeWritingModel(version *model.ArticleTypeVersion, requestedID uint64) (uint64, error) {
	if requestedID == 0 {
		for _, binding := range version.Models {
			if binding.IsDefault {
				requestedID = binding.WritingModelID
				break
			}
		}
		if requestedID == 0 && version.DefaultModelID != nil {
			requestedID = *version.DefaultModelID
		}
	}
	if requestedID == 0 {
		return 0, biz.ErrArticleGenerationModel
	}
	if len(version.Models) == 0 {
		return requestedID, nil
	}
	for _, binding := range version.Models {
		if binding.WritingModelID == requestedID {
			return requestedID, nil
		}
	}
	return 0, biz.ErrArticleGenerationModel
}

func validateGenerationVariables(fields []model.ArticleTypeInputField, values map[string]any) error {
	for _, field := range fields {
		value, exists := values[field.FieldKey]
		if (!exists || emptyGenerationValue(value)) && field.DefaultValue != "" {
			value = field.DefaultValue
			values[field.FieldKey] = value
			exists = true
		}
		if field.Required && (!exists || emptyGenerationValue(value)) {
			return biz.ErrArticleGenerationInvalid
		}
		if !exists || emptyGenerationValue(value) {
			continue
		}
		switch field.InputType {
		case model.ArticleTypeInputText, model.ArticleTypeInputTextarea:
			if _, ok := value.(string); !ok {
				return biz.ErrArticleGenerationInvalid
			}
		case model.ArticleTypeInputNumber:
			if _, ok := value.(float64); !ok {
				if text, stringValue := value.(string); !stringValue {
					return biz.ErrArticleGenerationInvalid
				} else if _, err := strconv.ParseFloat(text, 64); err != nil {
					return biz.ErrArticleGenerationInvalid
				}
			}
		case model.ArticleTypeInputSelect:
			text, ok := value.(string)
			if !ok || !articleTypeOptionAllowed(field.Options, text) {
				return biz.ErrArticleGenerationInvalid
			}
		case model.ArticleTypeInputMultiSelect:
			items, ok := value.([]any)
			if !ok {
				return biz.ErrArticleGenerationInvalid
			}
			for _, item := range items {
				text, ok := item.(string)
				if !ok || !articleTypeOptionAllowed(field.Options, text) {
					return biz.ErrArticleGenerationInvalid
				}
			}
		default:
			return biz.ErrArticleGenerationInvalid
		}
	}
	return nil
}

func addGenerationQuestionContext(tx *gorm.DB, input biz.ArticleGenerationInput, variables map[string]any) error {
	if input.KeywordID == 0 && input.QuestionID == 0 {
		return nil
	}
	var keyword model.Keyword
	if err := tx.Select("id", "brand_id", "text", "region").Where("enterprise_id = ? AND id = ?", input.EnterpriseID, input.KeywordID).First(&keyword).Error; err != nil {
		return biz.ErrArticleGenerationInvalid
	}
	if keyword.BrandID != input.BrandID {
		return biz.ErrArticleGenerationInvalid
	}
	variables["target_keyword"] = keyword.Text
	variables["target_region"] = keyword.Region
	if input.QuestionID == 0 {
		return nil
	}
	var question model.Question
	if err := tx.Select("id", "brand_id", "keyword_id", "text", "region", "status").Where("enterprise_id = ? AND id = ?", input.EnterpriseID, input.QuestionID).First(&question).Error; err != nil {
		return biz.ErrArticleGenerationInvalid
	}
	if question.BrandID != input.BrandID || question.KeywordID != input.KeywordID || question.Status != biz.QuestionStatusApproved {
		return biz.ErrArticleGenerationInvalid
	}
	variables["target_question"] = question.Text
	variables["distilled_questions"] = []string{question.Text}
	if question.Region != "" {
		variables["target_region"] = question.Region
	}
	return nil
}

func emptyGenerationValue(value any) bool {
	switch typed := value.(type) {
	case nil:
		return true
	case string:
		return strings.TrimSpace(typed) == ""
	case []any:
		return len(typed) == 0
	default:
		return false
	}
}

func articleTypeOptionAllowed(options []model.ArticleTypeInputOption, value string) bool {
	for _, option := range options {
		if option.OptionValue == value {
			return true
		}
	}
	return false
}

func buildGenerationPrompt(systemPrompt, userPromptTemplate string, articleTypeVersion *model.ArticleTypeVersion, brand model.Brand, variables map[string]any, knowledgeContext string, galleryRefs []biz.ArticleGenerationGalleryRef, instruction string) (generationPromptSnapshot, error) {
	values := make(map[string]any, len(variables)+10)
	for key, value := range variables {
		values[key] = value
	}
	values["brand_name"] = brand.Name
	values["brand_description"] = brand.Description
	values["brand_industry"] = brand.Industry
	values["brand_target_audience"] = brand.TargetAudience
	values["brand_core_value"] = brand.CoreValue
	values["knowledge_context"] = knowledgeContext
	values["user_instruction"] = instruction
	if _, ok := values["distilled_questions"]; !ok {
		values["distilled_questions"] = []string{}
	}

	tmpl, err := template.New("article_prompt").Option("missingkey=error").Parse(userPromptTemplate)
	if err != nil {
		return generationPromptSnapshot{}, err
	}
	var rendered bytes.Buffer
	if err := tmpl.Execute(&rendered, values); err != nil {
		return generationPromptSnapshot{}, err
	}
	userPrompt := rendered.String()
	if strings.TrimSpace(userPrompt) == "" {
		encoded, err := json.Marshal(variables)
		if err != nil {
			return generationPromptSnapshot{}, err
		}
		userPrompt = string(encoded)
	}
	var final strings.Builder
	final.WriteString(userPrompt)
	fmt.Fprintf(&final, "\n\n文章目标：%s\n目标受众：%s\n语气：%s\n建议字数：%d-%d。", articleTypeVersion.ContentGoal, articleTypeVersion.TargetAudience, articleTypeVersion.Tone, articleTypeVersion.RecommendedMinWords, articleTypeVersion.RecommendedMaxWords)
	if len(articleTypeVersion.Sections) > 0 {
		final.WriteString("\n\n文章结构：")
		for index, section := range articleTypeVersion.Sections {
			fmt.Fprintf(&final, "\n%d. %s：%s", index+1, section.Title, section.Guidance)
		}
	}
	for _, rule := range articleTypeVersion.Rules {
		if rule.RuleType == model.ArticleTypeRuleGEO {
			fmt.Fprintf(&final, "\nGEO 优化要求：%s", rule.RuleText)
		} else if rule.RuleType == model.ArticleTypeRuleQuality {
			fmt.Fprintf(&final, "\n质量要求：%s", rule.RuleText)
		}
	}
	if knowledgeContext != "" {
		fmt.Fprintf(&final, "\n\n只能把以下企业知识资料作为事实依据；资料没有覆盖的事实不得编造：%s", knowledgeContext)
	}
	if strings.TrimSpace(instruction) != "" {
		fmt.Fprintf(&final, "\n\n用户补充要求：%s", strings.TrimSpace(instruction))
	}
	if question, ok := variables["target_question"].(string); ok && strings.TrimSpace(question) != "" {
		fmt.Fprintf(&final, "\n\n本次文章必须直接回答目标问题：%s。文章标题必须围绕该问题，不能改写成无关主题。", strings.TrimSpace(question))
		if keyword, ok := variables["target_keyword"].(string); ok && strings.TrimSpace(keyword) != "" {
			fmt.Fprintf(&final, "\n目标关键词：%s。", strings.TrimSpace(keyword))
		}
		if region, ok := variables["target_region"].(string); ok && strings.TrimSpace(region) != "" {
			fmt.Fprintf(&final, "\n目标区域：%s；涉及地域表述时应保持自然且准确。", strings.TrimSpace(region))
		}
	}
	bodyImageCount := 0
	for _, ref := range galleryRefs {
		if ref.Placement == biz.ArticleGalleryPlacementBody {
			bodyImageCount++
		}
	}
	if bodyImageCount > 0 {
		final.WriteString("\n\n请根据段落语义，把以下图片占位符各使用一次并单独成行放在正文合适位置；不得修改、遗漏或重复占位符：")
		for _, ref := range galleryRefs {
			if ref.Placement != biz.ArticleGalleryPlacementBody {
				continue
			}
			fmt.Fprintf(
				&final,
				"\n- %s：相册“%s”，分类“%s”，文件“%s”",
				ref.Placeholder,
				ref.AlbumName,
				biz.KnowledgeCategoryLabel(ref.Category),
				ref.OriginalName,
			)
		}
	}
	final.WriteString("\n\n标题要求：标题必须准确概括文章核心结论，优先包含目标关键词或问题，长度控制在 20–40 字，避免空洞口号、夸大修饰或与主题无关的表述。")
	final.WriteString("\n\n只输出一个 JSON 对象，不要使用 Markdown 代码围栏。字段必须为 title、summary、content_markdown；content_markdown 是完整 Markdown 正文。")
	return generationPromptSnapshot{
		System: strings.TrimSpace(systemPrompt) + "\n\n文章类型中的系统提示词是本次生成的主提示词，决定文章方向、结构、语气与质量标准；用户补充要求和知识资料只能在不冲突时提供上下文。",
		User:   strings.TrimSpace(final.String()),
	}, nil
}

func completeGeneratedArticle(tx *gorm.DB, task *model.ArticleGenerationTask, articleTypeID uint64, input generationInputSnapshot, result *biz.ArticleGenerationResult) (*model.Article, *model.ArticleVersion, error) {
	article := &model.Article{}
	versionNumber := uint32(1)
	contentHTML := renderMarkdownToHTML(result.ContentMarkdown)
	if task.ArticleID == nil {
		*article = model.Article{
			TenantModel:     model.TenantModel{EnterpriseID: task.EnterpriseID},
			BrandID:         input.BrandID,
			ArticleTypeID:   &articleTypeID,
			Title:           result.Title,
			Summary:         result.Summary,
			ContentMarkdown: result.ContentMarkdown,
			ContentHTML:     contentHTML,
			Status:          "draft",
			Source:          "ai",
			Version:         1,
		}
		if err := tx.Create(article).Error; err != nil {
			return nil, nil, err
		}
	} else {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("enterprise_id = ? AND id = ?", task.EnterpriseID, *task.ArticleID).First(article).Error; err != nil {
			return nil, nil, err
		}
		if article.Status != "draft" && article.Status != "rejected" {
			return nil, nil, biz.ErrArticleState
		}
		var versionCount int64
		if err := tx.Model(&model.ArticleVersion{}).Where("enterprise_id = ? AND article_id = ?", task.EnterpriseID, article.ID).Count(&versionCount).Error; err != nil {
			return nil, nil, err
		}
		versionNumber = uint32(versionCount + 1)
		if err := tx.Model(article).Updates(map[string]any{
			"brand_id":         input.BrandID,
			"article_type_id":  articleTypeID,
			"title":            result.Title,
			"summary":          result.Summary,
			"content_markdown": result.ContentMarkdown,
			"content_html":     contentHTML,
			"source":           "ai",
			"version":          gorm.Expr("version + 1"),
		}).Error; err != nil {
			return nil, nil, err
		}
	}
	articleVersion := &model.ArticleVersion{
		ImmutableTenantModel: model.ImmutableTenantModel{EnterpriseID: task.EnterpriseID},
		ArticleID:            article.ID,
		VersionNumber:        versionNumber,
		Title:                result.Title,
		Summary:              result.Summary,
		ContentMarkdown:      result.ContentMarkdown,
		ContentHTML:          contentHTML,
		ChangeSource:         "ai_generation",
		ChangeSummary:        fmt.Sprintf("article generation task %d", task.ID),
		OperatorType:         "enterprise",
		OperatorID:           input.OperatorID,
		ContentHash:          contentHash(result.Title, result.ContentMarkdown, contentHTML),
	}
	if err := tx.Create(articleVersion).Error; err != nil {
		return nil, nil, err
	}
	return article, articleVersion, nil
}

// renderMarkdownToHTML converts the AI-generated Markdown into a minimal HTML
// snapshot so that the publishing worker can parse <img> tags and insert both
// text and inline images into platform editors.
func renderMarkdownToHTML(md string) string {
	md = strings.TrimSpace(md)
	if md == "" {
		return ""
	}

	var buf bytes.Buffer
	if err := goldmark.Convert([]byte(md), &buf); err != nil {
		// 回退到简单段落包裹，避免完全丢失内容
		paragraphs := strings.Split(html.EscapeString(md), "\n\n")
		var out strings.Builder
		for _, p := range paragraphs {
			p = strings.TrimSpace(p)
			if p == "" {
				continue
			}
			p = strings.ReplaceAll(p, "\n", "<br>")
			out.WriteString("<p>")
			out.WriteString(p)
			out.WriteString("</p>")
		}
		return out.String()
	}
	return buf.String()
}

// bindArticleGalleryImages persists exactly the images frozen on the generation
// task. It never selects a second set of images independently from the user's
// gallery choice.
func bindArticleGalleryImages(tx *gorm.DB, enterpriseID, articleID uint64, refsJSON []byte) error {
	var existing int64
	if err := tx.Unscoped().Model(&model.ArticleImage{}).
		Where("enterprise_id = ? AND article_id = ?", enterpriseID, articleID).
		Count(&existing).Error; err != nil {
		return err
	}
	if existing != 0 {
		return nil
	}
	if len(refsJSON) == 0 {
		return nil
	}
	var refs []biz.ArticleGenerationGalleryRef
	if err := json.Unmarshal(refsJSON, &refs); err != nil {
		return err
	}
	refs = biz.NormalizeArticleGenerationGalleryRefs(refs)
	if len(refs) == 0 {
		return nil
	}
	bindings := make([]model.ArticleImage, 0, len(refs))
	seen := make(map[uint64]struct{}, len(refs))
	for index, ref := range refs {
		if ref.ImageID == 0 {
			return biz.ErrArticleGenerationGallery
		}
		if _, duplicate := seen[ref.ImageID]; duplicate {
			continue
		}
		seen[ref.ImageID] = struct{}{}
		bindings = append(bindings, model.ArticleImage{
			TenantModel:    model.TenantModel{EnterpriseID: enterpriseID},
			ArticleID:      articleID,
			GalleryImageID: ref.ImageID,
			Placement:      ref.Placement,
			SortOrder:      int32(index),
		})
	}
	return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&bindings).Error
}

func articleGenerationDO(task *model.ArticleGenerationTask) *biz.ArticleGenerationTask {
	item := &biz.ArticleGenerationTask{
		ID:                   task.ID,
		EnterpriseID:         task.EnterpriseID,
		ArticleTypeVersionID: task.ArticleTypeVersionID,
		PromptVersionID:      numericID(task.PromptVersionID),
		WritingModelID:       task.WritingModelID,
		WritingModelVersion:  task.WritingModelVersion,
		ClientRequestID:      task.ClientRequestID,
		Status:               task.Status,
		InputJSON:            string(task.InputJSON),
		PromptSnapshot:       task.PromptSnapshot,
		ModelSnapshotJSON:    string(task.ModelSnapshotJSON),
		KnowledgeRefsJSON:    string(task.KnowledgeRefsJSON),
		GalleryRefsJSON:      string(task.GalleryRefsJSON),
		OutputJSON:           string(task.OutputJSON),
		InputTokens:          task.InputTokens,
		OutputTokens:         task.OutputTokens,
		CostMicros:           task.CostMicros,
		ErrorCode:            task.ErrorCode,
		ErrorMessage:         task.ErrorMessage,
		AttemptCount:         task.AttemptCount,
		StartedAt:            task.StartedAt,
		CompletedAt:          task.CompletedAt,
		CreatedAt:            task.CreatedAt,
		UpdatedAt:            task.UpdatedAt,
	}
	if task.ArticleID != nil {
		item.ArticleID = *task.ArticleID
	}
	if task.ResultArticleVersionID != nil {
		item.ResultArticleVersionID = *task.ResultArticleVersionID
	}
	if task.ResultSnapshotID != nil {
		item.ResultSnapshotID = *task.ResultSnapshotID
	}
	return item
}

func numericID(id *uint64) uint64 {
	if id == nil {
		return 0
	}
	return *id
}

func mapArticleGenerationError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return biz.ErrArticleGenerationNotFound
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return biz.ErrArticleGenerationConflict
	}
	return err
}
