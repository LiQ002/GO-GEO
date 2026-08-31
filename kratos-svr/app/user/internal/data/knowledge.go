package data

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/data/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	knowledgeChunkSize             = 2000
	knowledgeChunkOverlap          = 200
	systemKnowledgeBaseName        = "企业知识内容"
	systemKnowledgeBaseDescription = "系统自动维护的知识内容容器"
)

type knowledgeRepo struct {
	data *Data
}

func NewKnowledgeRepo(data *Data) biz.KnowledgeRepo {
	return &knowledgeRepo{data: data}
}

func (r *knowledgeRepo) CreateBase(ctx context.Context, base *biz.KnowledgeBase) (*biz.KnowledgeBase, error) {
	record := knowledgeBasePO(base)
	if err := r.data.DB(ctx).Create(record).Error; err != nil {
		return nil, mapKnowledgeBaseError(err)
	}
	return knowledgeBaseDO(record), nil
}

func (r *knowledgeRepo) GetBase(ctx context.Context, enterpriseID, id uint64) (*biz.KnowledgeBase, error) {
	var record model.KnowledgeBase
	if err := r.data.DB(ctx).Where("enterprise_id = ? AND id = ?", enterpriseID, id).First(&record).Error; err != nil {
		return nil, mapKnowledgeBaseError(err)
	}
	return knowledgeBaseDO(&record), nil
}

func (r *knowledgeRepo) ListBases(ctx context.Context, enterpriseID uint64, opts biz.KnowledgeBaseListOptions) ([]*biz.KnowledgeBase, int64, error) {
	db := r.data.DB(ctx).Model(&model.KnowledgeBase{}).Where("enterprise_id = ?", enterpriseID)
	if opts.Status != 0 {
		db = db.Where("status = ?", opts.Status)
	}
	if opts.Keyword != "" {
		like := "%" + opts.Keyword + "%"
		db = db.Where("name LIKE ? OR description LIKE ?", like, like)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var records []model.KnowledgeBase
	if err := db.Order("created_at DESC, id DESC").Offset(opts.Offset).Limit(opts.Limit).Find(&records).Error; err != nil {
		return nil, 0, err
	}
	items := make([]*biz.KnowledgeBase, 0, len(records))
	for i := range records {
		items = append(items, knowledgeBaseDO(&records[i]))
	}
	return items, total, nil
}

func (r *knowledgeRepo) UpdateBase(ctx context.Context, base *biz.KnowledgeBase) (*biz.KnowledgeBase, error) {
	result := r.data.DB(ctx).Model(&model.KnowledgeBase{}).
		Where("enterprise_id = ? AND id = ? AND version = ?", base.EnterpriseID, base.ID, base.Version).
		Updates(map[string]any{
			"name":        base.Name,
			"description": base.Description,
			"status":      base.Status,
			"version":     gorm.Expr("version + 1"),
		})
	if result.Error != nil {
		return nil, mapKnowledgeBaseError(result.Error)
	}
	if result.RowsAffected != 1 {
		return nil, biz.ErrKnowledgeBaseConflict
	}
	return r.GetBase(ctx, base.EnterpriseID, base.ID)
}

func (r *knowledgeRepo) DeleteBase(ctx context.Context, enterpriseID, id, version uint64) error {
	return r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var base model.KnowledgeBase
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("enterprise_id = ? AND id = ? AND version = ?", enterpriseID, id, version).
			First(&base).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return biz.ErrKnowledgeBaseConflict
			}
			return err
		}
		var documentCount int64
		if err := tx.Model(&model.KnowledgeDocument{}).
			Where("enterprise_id = ? AND knowledge_base_id = ?", enterpriseID, id).
			Count(&documentCount).Error; err != nil {
			return err
		}
		if documentCount != 0 {
			return biz.ErrKnowledgeBaseNotEmpty
		}
		return tx.Delete(&base).Error
	})
}

func (r *knowledgeRepo) CreateDocument(ctx context.Context, document *biz.KnowledgeDocument) (*biz.KnowledgeDocument, error) {
	record := knowledgeDocumentPO(document)
	content := strings.TrimSpace(document.Content)
	if content != "" {
		record.ContentHash = contentHash(content)
		record.ParseStatus = biz.KnowledgeParseStatusParsed
	}
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		baseID, err := resolveKnowledgeBase(tx, document.EnterpriseID, document.KnowledgeBaseID)
		if err != nil {
			return err
		}
		record.KnowledgeBaseID = baseID
		if err := tx.Create(record).Error; err != nil {
			return err
		}
		return createKnowledgeChunks(tx, record, content)
	})
	if err != nil {
		return nil, mapKnowledgeDocumentError(err)
	}
	return knowledgeDocumentDO(record), nil
}

func (r *knowledgeRepo) GetDocument(ctx context.Context, enterpriseID, id uint64) (*biz.KnowledgeDocument, error) {
	var record model.KnowledgeDocument
	db := r.data.DB(ctx)
	if err := db.Where("enterprise_id = ? AND id = ?", enterpriseID, id).First(&record).Error; err != nil {
		return nil, mapKnowledgeDocumentError(err)
	}
	records := []model.KnowledgeDocument{record}
	if err := hydrateKnowledgeDocumentContent(r.data.DB(ctx), enterpriseID, records); err != nil {
		return nil, err
	}
	record = records[0]
	return knowledgeDocumentDO(&record), nil
}

func (r *knowledgeRepo) ListDocuments(ctx context.Context, enterpriseID uint64, opts biz.KnowledgeDocumentListOptions) ([]*biz.KnowledgeDocument, int64, error) {
	db := r.data.DB(ctx).Model(&model.KnowledgeDocument{}).Where("enterprise_id = ?", enterpriseID)
	if opts.KnowledgeBaseID != 0 {
		db = db.Where("knowledge_base_id = ?", opts.KnowledgeBaseID)
	}
	if opts.Category != 0 {
		db = db.Where("category = ?", opts.Category)
	}
	if opts.SourceType != 0 {
		db = db.Where("source_type = ?", opts.SourceType)
	}
	if opts.ParseStatus != 0 {
		db = db.Where("parse_status = ?", opts.ParseStatus)
	}
	if opts.Keyword != "" {
		like := "%" + opts.Keyword + "%"
		db = db.Where("title LIKE ? OR content LIKE ?", like, like)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var records []model.KnowledgeDocument
	if err := db.Order("created_at DESC, id DESC").Offset(opts.Offset).Limit(opts.Limit).Find(&records).Error; err != nil {
		return nil, 0, err
	}
	if err := hydrateKnowledgeDocumentContent(r.data.DB(ctx), enterpriseID, records); err != nil {
		return nil, 0, err
	}
	items := make([]*biz.KnowledgeDocument, 0, len(records))
	for i := range records {
		items = append(items, knowledgeDocumentDO(&records[i]))
	}
	return items, total, nil
}

func (r *knowledgeRepo) UpdateDocument(ctx context.Context, document *biz.KnowledgeDocument) (*biz.KnowledgeDocument, error) {
	content := strings.TrimSpace(document.Content)
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var current model.KnowledgeDocument
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("enterprise_id = ? AND id = ? AND document_version = ?", document.EnterpriseID, document.ID, document.DocumentVersion).
			First(&current).Error; err != nil {
			return err
		}
		baseID := document.KnowledgeBaseID
		if baseID == 0 {
			baseID = current.KnowledgeBaseID
		} else if err := requireKnowledgeBase(tx, document.EnterpriseID, baseID); err != nil {
			return err
		}

		newVersion := current.DocumentVersion + 1
		if current.SourceType != biz.KnowledgeSourceTypeText && document.SourceType == biz.KnowledgeSourceTypeText && content == "" {
			return biz.ErrKnowledgeDocInvalid
		}
		updates := map[string]any{
			"knowledge_base_id": baseID,
			"category":          document.Category,
			"title":             document.Title,
			"source_type":       document.SourceType,
			"source_url":        document.SourceURL,
			"object_key":        document.ObjectKey,
			"mime_type":         document.MimeType,
			"metadata_json":     nullableJSON(document.MetadataJSON),
			"document_version":  newVersion,
		}
		sourceChanged := current.SourceType != document.SourceType || current.SourceURL != document.SourceURL || current.ObjectKey != document.ObjectKey
		if sourceChanged {
			updates["parse_status"] = biz.KnowledgeParseStatusPending
			updates["parse_error"] = ""
			updates["content_hash"] = ""
		}
		if content != "" {
			updates["content"] = content
			updates["parse_status"] = biz.KnowledgeParseStatusParsed
			updates["parse_error"] = ""
			updates["content_hash"] = contentHash(content)
		}
		if err := tx.Model(&current).Updates(updates).Error; err != nil {
			return err
		}
		current.DocumentVersion = newVersion
		current.KnowledgeBaseID = baseID
		current.Category = document.Category
		current.MetadataJSON = nullableJSON(document.MetadataJSON)
		if content != "" {
			current.Content = content
			return createKnowledgeChunks(tx, &current, content)
		}
		if current.SourceType == biz.KnowledgeSourceTypeText && document.SourceType == biz.KnowledgeSourceTypeText {
			if strings.TrimSpace(current.Content) != "" {
				return createKnowledgeChunks(tx, &current, current.Content)
			}
			return cloneKnowledgeChunks(tx, &current, newVersion-1)
		}
		return nil
	})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, biz.ErrKnowledgeDocConflict
		}
		return nil, mapKnowledgeDocumentError(err)
	}
	return r.GetDocument(ctx, document.EnterpriseID, document.ID)
}

func (r *knowledgeRepo) DeleteDocument(ctx context.Context, enterpriseID, id uint64, version uint32) error {
	result := r.data.DB(ctx).Where("enterprise_id = ? AND id = ? AND document_version = ?", enterpriseID, id, version).Delete(&model.KnowledgeDocument{})
	if result.Error != nil {
		return mapKnowledgeDocumentError(result.Error)
	}
	if result.RowsAffected != 1 {
		return biz.ErrKnowledgeDocConflict
	}
	return nil
}

func (r *knowledgeRepo) RetryDocumentParse(ctx context.Context, enterpriseID, id uint64, version uint32) (*biz.KnowledgeDocument, error) {
	result := r.data.DB(ctx).Model(&model.KnowledgeDocument{}).
		Where("enterprise_id = ? AND id = ? AND document_version = ? AND source_type IN ?", enterpriseID, id, version, []int32{biz.KnowledgeSourceTypeURL, biz.KnowledgeSourceTypeFile}).
		Updates(map[string]any{
			"parse_status":     biz.KnowledgeParseStatusPending,
			"parse_error":      "",
			"document_version": gorm.Expr("document_version + 1"),
		})
	if result.Error != nil {
		return nil, mapKnowledgeDocumentError(result.Error)
	}
	if result.RowsAffected != 1 {
		return nil, biz.ErrKnowledgeDocConflict
	}
	return r.GetDocument(ctx, enterpriseID, id)
}

func (r *knowledgeRepo) ListChunks(ctx context.Context, enterpriseID, documentID uint64, opts biz.KnowledgeChunkListOptions) ([]*biz.KnowledgeChunk, int64, error) {
	document, err := r.GetDocument(ctx, enterpriseID, documentID)
	if err != nil {
		return nil, 0, err
	}
	version := opts.DocumentVersion
	if version == 0 {
		version = document.DocumentVersion
	}
	db := r.data.DB(ctx).Model(&model.KnowledgeChunk{}).
		Where("enterprise_id = ? AND knowledge_document_id = ? AND document_version = ?", enterpriseID, documentID, version)
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var records []model.KnowledgeChunk
	if err := db.Order("chunk_index ASC").Offset(opts.Offset).Limit(opts.Limit).Find(&records).Error; err != nil {
		return nil, 0, err
	}
	items := make([]*biz.KnowledgeChunk, 0, len(records))
	for i := range records {
		items = append(items, knowledgeChunkDO(&records[i]))
	}
	return items, total, nil
}

func knowledgeBasePO(base *biz.KnowledgeBase) *model.KnowledgeBase {
	return &model.KnowledgeBase{
		TenantModel: model.TenantModel{EnterpriseID: base.EnterpriseID},
		Name:        strings.TrimSpace(base.Name),
		Description: strings.TrimSpace(base.Description),
		Status:      base.Status,
		Version:     1,
	}
}

func knowledgeBaseDO(record *model.KnowledgeBase) *biz.KnowledgeBase {
	return &biz.KnowledgeBase{
		ID:           record.ID,
		EnterpriseID: record.EnterpriseID,
		Name:         record.Name,
		Description:  record.Description,
		Status:       record.Status,
		Version:      record.Version,
		CreatedAt:    record.CreatedAt,
		UpdatedAt:    record.UpdatedAt,
	}
}

func knowledgeDocumentPO(document *biz.KnowledgeDocument) *model.KnowledgeDocument {
	return &model.KnowledgeDocument{
		TenantModel:     model.TenantModel{EnterpriseID: document.EnterpriseID},
		KnowledgeBaseID: document.KnowledgeBaseID,
		Category:        document.Category,
		Title:           strings.TrimSpace(document.Title),
		Content:         strings.TrimSpace(document.Content),
		SourceType:      document.SourceType,
		SourceURL:       strings.TrimSpace(document.SourceURL),
		ObjectKey:       strings.TrimSpace(document.ObjectKey),
		MimeType:        strings.TrimSpace(document.MimeType),
		ParseStatus:     biz.KnowledgeParseStatusPending,
		DocumentVersion: 1,
		MetadataJSON:    nullableJSON(document.MetadataJSON),
	}
}

func knowledgeDocumentDO(record *model.KnowledgeDocument) *biz.KnowledgeDocument {
	category := record.Category
	if category == 0 {
		category = biz.KnowledgeCategoryEnterpriseProfile
	}
	return &biz.KnowledgeDocument{
		ID:              record.ID,
		EnterpriseID:    record.EnterpriseID,
		KnowledgeBaseID: record.KnowledgeBaseID,
		Category:        category,
		Title:           record.Title,
		Content:         record.Content,
		SourceType:      record.SourceType,
		SourceURL:       record.SourceURL,
		ObjectKey:       record.ObjectKey,
		ContentHash:     record.ContentHash,
		MimeType:        record.MimeType,
		ParseStatus:     record.ParseStatus,
		ParseError:      record.ParseError,
		DocumentVersion: record.DocumentVersion,
		MetadataJSON:    string(record.MetadataJSON),
		CreatedAt:       record.CreatedAt,
		UpdatedAt:       record.UpdatedAt,
	}
}

func knowledgeChunkDO(record *model.KnowledgeChunk) *biz.KnowledgeChunk {
	return &biz.KnowledgeChunk{
		ID:                  record.ID,
		EnterpriseID:        record.EnterpriseID,
		KnowledgeDocumentID: record.KnowledgeDocumentID,
		DocumentVersion:     record.DocumentVersion,
		ChunkIndex:          record.ChunkIndex,
		Content:             record.Content,
		ContentHash:         record.ContentHash,
		LocatorJSON:         string(record.LocatorJSON),
		MetadataJSON:        string(record.MetadataJSON),
		CreatedAt:           record.CreatedAt,
	}
}

func requireKnowledgeBase(db *gorm.DB, enterpriseID, baseID uint64) error {
	var base model.KnowledgeBase
	if err := db.Select("id").Where("enterprise_id = ? AND id = ?", enterpriseID, baseID).First(&base).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return biz.ErrKnowledgeBaseNotFound
		}
		return err
	}
	return nil
}

func resolveKnowledgeBase(db *gorm.DB, enterpriseID, baseID uint64) (uint64, error) {
	if baseID != 0 {
		if err := requireKnowledgeBase(db, enterpriseID, baseID); err != nil {
			return 0, err
		}
		return baseID, nil
	}

	var base model.KnowledgeBase
	err := db.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("enterprise_id = ? AND name = ? AND status = ?", enterpriseID, systemKnowledgeBaseName, biz.KnowledgeBaseStatusActive).
		First(&base).Error
	if err == nil {
		return base.ID, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, err
	}
	base = model.KnowledgeBase{
		TenantModel: model.TenantModel{EnterpriseID: enterpriseID},
		Name:        systemKnowledgeBaseName,
		Description: systemKnowledgeBaseDescription,
		Status:      biz.KnowledgeBaseStatusActive,
		Version:     1,
	}
	if err := db.Create(&base).Error; err != nil {
		return 0, err
	}
	return base.ID, nil
}

func createKnowledgeChunks(db *gorm.DB, document *model.KnowledgeDocument, content string) error {
	if content == "" {
		return nil
	}
	parts := splitKnowledgeContent(content)
	chunks := make([]model.KnowledgeChunk, 0, len(parts))
	for i, part := range parts {
		locator, err := json.Marshal(map[string]uint32{
			"document_version": document.DocumentVersion,
			"chunk_index":      uint32(i),
		})
		if err != nil {
			return err
		}
		chunks = append(chunks, model.KnowledgeChunk{
			ImmutableTenantModel: model.ImmutableTenantModel{EnterpriseID: document.EnterpriseID},
			KnowledgeDocumentID:  document.ID,
			DocumentVersion:      document.DocumentVersion,
			ChunkIndex:           uint32(i),
			Content:              part,
			ContentHash:          contentHash(part),
			LocatorJSON:          locator,
			MetadataJSON:         document.MetadataJSON,
		})
	}
	return db.Create(&chunks).Error
}

func cloneKnowledgeChunks(db *gorm.DB, document *model.KnowledgeDocument, sourceVersion uint32) error {
	var existing []model.KnowledgeChunk
	if err := db.Where(
		"enterprise_id = ? AND knowledge_document_id = ? AND document_version = ?",
		document.EnterpriseID,
		document.ID,
		sourceVersion,
	).Order("chunk_index ASC").Find(&existing).Error; err != nil {
		return err
	}
	if len(existing) == 0 {
		return nil
	}
	cloned := make([]model.KnowledgeChunk, 0, len(existing))
	for i := range existing {
		locator, err := json.Marshal(map[string]uint32{
			"document_version": document.DocumentVersion,
			"chunk_index":      existing[i].ChunkIndex,
		})
		if err != nil {
			return err
		}
		cloned = append(cloned, model.KnowledgeChunk{
			ImmutableTenantModel: model.ImmutableTenantModel{EnterpriseID: document.EnterpriseID},
			KnowledgeDocumentID:  document.ID,
			DocumentVersion:      document.DocumentVersion,
			ChunkIndex:           existing[i].ChunkIndex,
			Content:              existing[i].Content,
			ContentHash:          existing[i].ContentHash,
			LocatorJSON:          locator,
			MetadataJSON:         document.MetadataJSON,
		})
	}
	return db.Create(&cloned).Error
}

func hydrateKnowledgeDocumentContent(db *gorm.DB, enterpriseID uint64, documents []model.KnowledgeDocument) error {
	documentVersions := make(map[uint64]uint32)
	documentIndexes := make(map[uint64]int)
	documentIDs := make([]uint64, 0, len(documents))
	for i := range documents {
		if documents[i].SourceType != biz.KnowledgeSourceTypeText || strings.TrimSpace(documents[i].Content) != "" {
			continue
		}
		documentIDs = append(documentIDs, documents[i].ID)
		documentVersions[documents[i].ID] = documents[i].DocumentVersion
		documentIndexes[documents[i].ID] = i
	}
	if len(documentIDs) == 0 {
		return nil
	}
	var chunks []model.KnowledgeChunk
	if err := db.Where("enterprise_id = ? AND knowledge_document_id IN ?", enterpriseID, documentIDs).
		Order("knowledge_document_id ASC, document_version ASC, chunk_index ASC").
		Find(&chunks).Error; err != nil {
		return err
	}
	grouped := make(map[uint64][]string)
	for i := range chunks {
		if chunks[i].DocumentVersion == documentVersions[chunks[i].KnowledgeDocumentID] {
			grouped[chunks[i].KnowledgeDocumentID] = append(grouped[chunks[i].KnowledgeDocumentID], chunks[i].Content)
		}
	}
	for documentID, parts := range grouped {
		documents[documentIndexes[documentID]].Content = joinKnowledgeChunks(parts)
	}
	return nil
}

func joinKnowledgeChunks(parts []string) string {
	if len(parts) == 0 {
		return ""
	}
	joined := []rune(parts[0])
	for _, part := range parts[1:] {
		next := []rune(part)
		maxOverlap := min(knowledgeChunkOverlap, len(joined), len(next))
		overlap := 0
		for size := maxOverlap; size > 0; size-- {
			if string(joined[len(joined)-size:]) == string(next[:size]) {
				overlap = size
				break
			}
		}
		if overlap == 0 {
			joined = append(joined, '\n')
		}
		joined = append(joined, next[overlap:]...)
	}
	return strings.TrimSpace(string(joined))
}

func splitKnowledgeContent(content string) []string {
	runes := []rune(strings.TrimSpace(content))
	if len(runes) == 0 {
		return nil
	}
	parts := make([]string, 0, (len(runes)+knowledgeChunkSize-1)/knowledgeChunkSize)
	for start := 0; start < len(runes); {
		end := min(start+knowledgeChunkSize, len(runes))
		parts = append(parts, strings.TrimSpace(string(runes[start:end])))
		if end == len(runes) {
			break
		}
		start = end - knowledgeChunkOverlap
	}
	return parts
}

func nullableJSON(value string) []byte {
	if value == "" {
		return nil
	}
	return []byte(value)
}

func mapKnowledgeBaseError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return biz.ErrKnowledgeBaseNotFound
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return biz.ErrKnowledgeBaseConflict
	}
	return err
}

func mapKnowledgeDocumentError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return biz.ErrKnowledgeDocNotFound
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return biz.ErrKnowledgeDocConflict
	}
	return err
}
