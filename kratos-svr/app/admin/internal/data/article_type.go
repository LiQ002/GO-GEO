package data

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/data/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type articleTypeRepo struct{ data *Data }

func NewArticleTypeRepo(data *Data) biz.ArticleTypeRepo { return &articleTypeRepo{data: data} }

func (r *articleTypeRepo) Create(ctx context.Context, item *biz.ArticleType) (*biz.ArticleType, error) {
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		if err := validateArticleTypeConfigReferences(tx, item.Config); err != nil {
			return err
		}
		po := articleTypePO(item)
		if err := tx.Create(po).Error; err != nil {
			return err
		}
		item.ID = po.ID
		version := &biz.ArticleTypeVersion{
			ArticleTypeID: po.ID,
			Status:        model.ArticleTypeVersionStatusPublished,
			Config:        item.Config,
			ChangeSummary: item.ConfigChangeSummary,
			PublishedBy:   item.PublishedBy,
		}
		created, err := createArticleTypeVersion(tx, version)
		if err != nil {
			return err
		}
		return tx.Model(po).Update("current_version_id", created.ID).Error
	})
	if err != nil {
		return nil, mapArticleTypeError(err)
	}
	return r.Get(ctx, item.ID)
}

func (r *articleTypeRepo) Get(ctx context.Context, id uint64) (*biz.ArticleType, error) {
	var po model.ArticleType
	if err := r.data.DB(ctx).First(&po, id).Error; err != nil {
		return nil, mapArticleTypeError(err)
	}
	items := []*model.ArticleType{&po}
	if err := hydrateArticleTypes(r.data.DB(ctx), items); err != nil {
		return nil, mapArticleTypeError(err)
	}
	return articleTypeDO(&po), nil
}

func (r *articleTypeRepo) List(ctx context.Context, opts biz.ArticleTypeListOptions) ([]*biz.ArticleType, int64, error) {
	db := r.data.DB(ctx).Model(&model.ArticleType{})
	if opts.Status != 0 {
		db = db.Where("status = ?", opts.Status)
	}
	if opts.SourceType != 0 {
		db = db.Where("source_type = ?", opts.SourceType)
	}
	if opts.Visible != nil {
		db = db.Where("visible = ?", *opts.Visible)
	}
	if opts.Keyword != "" {
		keyword := "%" + opts.Keyword + "%"
		db = db.Where("name LIKE ? OR code LIKE ?", keyword, keyword)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, mapArticleTypeError(err)
	}
	var records []*model.ArticleType
	if err := db.Order("sort_order ASC, id DESC").Offset(opts.Offset).Limit(opts.Limit).Find(&records).Error; err != nil {
		return nil, 0, mapArticleTypeError(err)
	}
	if err := hydrateArticleTypes(r.data.DB(ctx), records); err != nil {
		return nil, 0, mapArticleTypeError(err)
	}
	items := make([]*biz.ArticleType, 0, len(records))
	for _, record := range records {
		items = append(items, articleTypeDO(record))
	}
	return items, total, nil
}

func (r *articleTypeRepo) Update(ctx context.Context, item *biz.ArticleType) (*biz.ArticleType, error) {
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		if err := validateArticleTypeConfigReferences(tx, item.Config); err != nil {
			return err
		}
		version := &biz.ArticleTypeVersion{
			ArticleTypeID: item.ID,
			Status:        model.ArticleTypeVersionStatusPublished,
			Config:        item.Config,
			ChangeSummary: item.ConfigChangeSummary,
			PublishedBy:   item.PublishedBy,
		}
		created, err := createArticleTypeVersion(tx, version)
		if err != nil {
			return err
		}
		updates := map[string]any{
			"name": item.Name, "description": item.Description, "icon": item.Icon,
			"status": item.Status, "visible": item.Visible, "sort_order": item.SortOrder,
			"visibility_json": jsonBytes(item.VisibilityJSON), "current_version_id": created.ID,
			"version": gorm.Expr("version + 1"),
		}
		result := tx.Model(&model.ArticleType{}).Where("id = ? AND version = ?", item.ID, item.Version).Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return biz.ErrArticleTypeConflict
		}
		return nil
	})
	if err != nil {
		return nil, mapArticleTypeError(err)
	}
	return r.Get(ctx, item.ID)
}

func (r *articleTypeRepo) Delete(ctx context.Context, id, version uint64) error {
	result := r.data.DB(ctx).Where("id = ? AND version = ?", id, version).Delete(&model.ArticleType{})
	if result.Error != nil {
		return mapArticleTypeError(result.Error)
	}
	if result.RowsAffected != 1 {
		return biz.ErrArticleTypeConflict
	}
	return nil
}

func (r *articleTypeRepo) CreateVersion(ctx context.Context, item *biz.ArticleTypeVersion) (*biz.ArticleTypeVersion, error) {
	var created *model.ArticleTypeVersion
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		if err := validateArticleTypeConfigReferences(tx, item.Config); err != nil {
			return err
		}
		var err error
		created, err = createArticleTypeVersion(tx, item)
		return err
	})
	if err != nil {
		return nil, mapArticleTypeError(err)
	}
	versions, err := loadArticleTypeVersions(r.data.DB(ctx), []uint64{created.ID})
	if err != nil {
		return nil, mapArticleTypeError(err)
	}
	return articleTypeVersionDO(versions[created.ID]), nil
}

func (r *articleTypeRepo) ListVersions(ctx context.Context, articleTypeID uint64) ([]*biz.ArticleTypeVersion, error) {
	var records []model.ArticleTypeVersion
	if err := r.data.DB(ctx).Where("article_type_id = ?", articleTypeID).Order("version_number DESC").Find(&records).Error; err != nil {
		return nil, mapArticleTypeError(err)
	}
	ids := make([]uint64, 0, len(records))
	for i := range records {
		ids = append(ids, records[i].ID)
	}
	loaded, err := loadArticleTypeVersions(r.data.DB(ctx), ids)
	if err != nil {
		return nil, mapArticleTypeError(err)
	}
	items := make([]*biz.ArticleTypeVersion, 0, len(records))
	for i := range records {
		items = append(items, articleTypeVersionDO(loaded[records[i].ID]))
	}
	return items, nil
}

func (r *articleTypeRepo) SetCurrentVersion(ctx context.Context, articleTypeID, versionID, expectedVersion uint64) (*biz.ArticleType, error) {
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var version model.ArticleTypeVersion
		if err := tx.Where("id = ? AND article_type_id = ?", versionID, articleTypeID).First(&version).Error; err != nil {
			return err
		}
		result := tx.Model(&model.ArticleType{}).Where("id = ? AND version = ?", articleTypeID, expectedVersion).
			Updates(map[string]any{"current_version_id": versionID, "version": gorm.Expr("version + 1")})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return biz.ErrArticleTypeConflict
		}
		return tx.Model(&version).Update("status", model.ArticleTypeVersionStatusPublished).Error
	})
	if err != nil {
		return nil, mapArticleTypeError(err)
	}
	return r.Get(ctx, articleTypeID)
}

func createArticleTypeVersion(tx *gorm.DB, item *biz.ArticleTypeVersion) (*model.ArticleTypeVersion, error) {
	var articleType model.ArticleType
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&articleType, item.ArticleTypeID).Error; err != nil {
		return nil, err
	}
	var maxVersion uint32
	if err := tx.Model(&model.ArticleTypeVersion{}).Where("article_type_id = ?", item.ArticleTypeID).
		Select("COALESCE(MAX(version_number), 0)").Scan(&maxVersion).Error; err != nil {
		return nil, err
	}
	created := articleTypeVersionPO(item)
	created.VersionNumber = maxVersion + 1
	if err := tx.Omit("Sections", "InputFields", "Rules", "Models", "Channels").Create(created).Error; err != nil {
		return nil, err
	}
	if err := createArticleTypeConfigRows(tx, created.ID, item.Config); err != nil {
		return nil, err
	}
	return created, nil
}

func createArticleTypeConfigRows(tx *gorm.DB, versionID uint64, config *biz.ArticleTypeConfig) error {
	for index, item := range config.Sections {
		row := model.ArticleTypeSection{ArticleTypeVersionID: versionID, SortOrder: uint32(index), Title: strings.TrimSpace(item.Title), Guidance: strings.TrimSpace(item.Guidance), Required: item.Required}
		if err := tx.Create(&row).Error; err != nil {
			return err
		}
	}
	for index, item := range config.InputFields {
		row := model.ArticleTypeInputField{ArticleTypeVersionID: versionID, SortOrder: uint32(index), FieldKey: strings.TrimSpace(item.Key), Label: strings.TrimSpace(item.Label), InputType: item.InputType, Required: item.Required, Placeholder: strings.TrimSpace(item.Placeholder), HelpText: strings.TrimSpace(item.HelpText), DefaultValue: item.DefaultValue}
		if err := tx.Create(&row).Error; err != nil {
			return err
		}
		for optionIndex, option := range item.Options {
			optionRow := model.ArticleTypeInputOption{ArticleTypeInputFieldID: row.ID, SortOrder: uint32(optionIndex), OptionValue: strings.TrimSpace(option)}
			if err := tx.Create(&optionRow).Error; err != nil {
				return err
			}
		}
	}
	for index, rule := range config.GEORules {
		row := model.ArticleTypeRule{ArticleTypeVersionID: versionID, RuleType: model.ArticleTypeRuleGEO, SortOrder: uint32(index), RuleText: strings.TrimSpace(rule)}
		if err := tx.Create(&row).Error; err != nil {
			return err
		}
	}
	for index, rule := range config.QualityRules {
		row := model.ArticleTypeRule{ArticleTypeVersionID: versionID, RuleType: model.ArticleTypeRuleQuality, SortOrder: uint32(index), RuleText: strings.TrimSpace(rule)}
		if err := tx.Create(&row).Error; err != nil {
			return err
		}
	}
	for index, id := range config.WritingModelIDs {
		row := model.ArticleTypeModel{ArticleTypeVersionID: versionID, WritingModelID: id, IsDefault: id == config.DefaultWritingModelID, SortOrder: uint32(index)}
		if err := tx.Create(&row).Error; err != nil {
			return err
		}
	}
	for index, id := range config.PublishChannelIDs {
		row := model.ArticleTypeVersionChannel{ArticleTypeVersionID: versionID, PublishChannelID: id, SortOrder: uint32(index)}
		if err := tx.Create(&row).Error; err != nil {
			return err
		}
	}
	return nil
}

func validateArticleTypeConfigReferences(tx *gorm.DB, config *biz.ArticleTypeConfig) error {
	if config == nil {
		return biz.ErrArticleTypeInvalid
	}
	if len(config.WritingModelIDs) > 0 {
		var count int64
		if err := tx.Model(&model.WritingModel{}).Where("id IN ?", config.WritingModelIDs).Count(&count).Error; err != nil {
			return err
		}
		if count != int64(len(config.WritingModelIDs)) {
			return biz.ErrArticleTypeInvalid
		}
	}
	if len(config.PublishChannelIDs) > 0 {
		var count int64
		if err := tx.Model(&model.PublishChannel{}).Where("id IN ?", config.PublishChannelIDs).Count(&count).Error; err != nil {
			return err
		}
		if count != int64(len(config.PublishChannelIDs)) {
			return biz.ErrArticleTypeInvalid
		}
	}
	return nil
}

func hydrateArticleTypes(db *gorm.DB, records []*model.ArticleType) error {
	ids := make([]uint64, 0, len(records))
	for _, record := range records {
		if record.CurrentVersionID != nil {
			ids = append(ids, *record.CurrentVersionID)
		}
	}
	versions, err := loadArticleTypeVersions(db, ids)
	if err != nil {
		return err
	}
	for _, record := range records {
		if record.CurrentVersionID == nil {
			continue
		}
		if version := versions[*record.CurrentVersionID]; version != nil {
			record.CurrentVersion = version
		}
	}
	return nil
}

func loadArticleTypeVersions(db *gorm.DB, ids []uint64) (map[uint64]*model.ArticleTypeVersion, error) {
	result := make(map[uint64]*model.ArticleTypeVersion, len(ids))
	if len(ids) == 0 {
		return result, nil
	}
	var versions []*model.ArticleTypeVersion
	query := db.
		Preload("Sections", func(query *gorm.DB) *gorm.DB { return query.Order("sort_order ASC") }).
		Preload("InputFields", func(query *gorm.DB) *gorm.DB { return query.Order("sort_order ASC") }).
		Preload("InputFields.Options", func(query *gorm.DB) *gorm.DB { return query.Order("sort_order ASC") }).
		Preload("Rules", func(query *gorm.DB) *gorm.DB { return query.Order("rule_type ASC, sort_order ASC") }).
		Preload("Models", func(query *gorm.DB) *gorm.DB { return query.Order("sort_order ASC") }).
		Preload("Channels", func(query *gorm.DB) *gorm.DB { return query.Order("sort_order ASC") })
	if err := query.Find(&versions, ids).Error; err != nil {
		return nil, err
	}
	promptIDs := make([]uint64, 0, len(versions))
	for _, version := range versions {
		if version.PromptVersionID != nil && (strings.TrimSpace(version.SystemPrompt) == "" || strings.TrimSpace(version.UserPromptTemplate) == "") {
			promptIDs = append(promptIDs, *version.PromptVersionID)
		}
	}
	prompts := make(map[uint64]model.PromptVersion, len(promptIDs))
	if len(promptIDs) > 0 {
		var rows []model.PromptVersion
		if err := db.Find(&rows, promptIDs).Error; err != nil {
			return nil, err
		}
		for _, row := range rows {
			prompts[row.ID] = row
		}
	}
	for _, version := range versions {
		if version.PromptVersionID != nil {
			if prompt, ok := prompts[*version.PromptVersionID]; ok {
				if strings.TrimSpace(version.SystemPrompt) == "" {
					version.SystemPrompt = prompt.SystemPrompt
				}
				if strings.TrimSpace(version.UserPromptTemplate) == "" {
					version.UserPromptTemplate = prompt.Template
				}
			}
		}
		result[version.ID] = version
	}
	return result, nil
}

func articleTypePO(item *biz.ArticleType) *model.ArticleType {
	return &model.ArticleType{Code: item.Code, Name: item.Name, Description: item.Description, Icon: item.Icon, SourceType: item.SourceType, Status: item.Status, Visible: item.Visible, SortOrder: item.SortOrder, VisibilityJSON: jsonBytes(item.VisibilityJSON), Version: item.Version}
}

func articleTypeDO(po *model.ArticleType) *biz.ArticleType {
	item := &biz.ArticleType{ID: po.ID, Code: po.Code, Name: po.Name, Description: po.Description, Icon: po.Icon, SourceType: po.SourceType, Status: po.Status, Visible: po.Visible, SortOrder: po.SortOrder, VisibilityJSON: string(po.VisibilityJSON), Version: po.Version, CreatedAt: po.CreatedAt, UpdatedAt: po.UpdatedAt}
	if po.CurrentVersionID != nil {
		item.CurrentVersionID = *po.CurrentVersionID
		if version := po.CurrentVersion; version != nil {
			item.ConfigRevision = version.VersionNumber
			item.Config = articleTypeConfigDO(version)
		}
	}
	return item
}

func articleTypeVersionPO(item *biz.ArticleTypeVersion) *model.ArticleTypeVersion {
	config := item.Config
	structureJSON, _ := json.Marshal(config.Sections)
	inputJSON, _ := json.Marshal(config.InputFields)
	geoJSON, _ := json.Marshal(config.GEORules)
	qualityJSON, _ := json.Marshal(config.QualityRules)
	modelIDsJSON, _ := json.Marshal(config.WritingModelIDs)
	po := &model.ArticleTypeVersion{ArticleTypeID: item.ArticleTypeID, VersionNumber: item.VersionNumber, Status: item.Status, ContentGoal: config.ContentGoal, TargetAudience: config.TargetAudience, Tone: config.Tone, RecommendedMinWords: config.RecommendedMinWords, RecommendedMaxWords: config.RecommendedMaxWords, StructureJSON: structureJSON, InputSchemaJSON: inputJSON, GEORulesJSON: geoJSON, QualityRulesJSON: qualityJSON, FallbackModelIDsJSON: modelIDsJSON, SystemPrompt: config.SystemPrompt, UserPromptTemplate: config.UserPromptTemplate, OutputFormat: config.OutputFormat, ChangeSummary: item.ChangeSummary}
	if item.PromptVersionID != 0 {
		po.PromptVersionID = &item.PromptVersionID
	}
	if config.DefaultWritingModelID != 0 {
		po.DefaultModelID = &config.DefaultWritingModelID
	}
	if item.PublishedBy != 0 {
		po.PublishedBy = &item.PublishedBy
	}
	return po
}

func articleTypeVersionDO(po *model.ArticleTypeVersion) *biz.ArticleTypeVersion {
	item := &biz.ArticleTypeVersion{ID: po.ID, ArticleTypeID: po.ArticleTypeID, VersionNumber: po.VersionNumber, Status: po.Status, ContentGoal: po.ContentGoal, TargetAudience: po.TargetAudience, Tone: po.Tone, RecommendedMinWords: po.RecommendedMinWords, RecommendedMaxWords: po.RecommendedMaxWords, StructureJSON: string(po.StructureJSON), InputSchemaJSON: string(po.InputSchemaJSON), GEORulesJSON: string(po.GEORulesJSON), QualityRulesJSON: string(po.QualityRulesJSON), FallbackModelIDsJSON: string(po.FallbackModelIDsJSON), ChangeSummary: po.ChangeSummary, Config: articleTypeConfigDO(po), CreatedAt: po.CreatedAt}
	if po.PromptVersionID != nil {
		item.PromptVersionID = *po.PromptVersionID
	}
	if po.DefaultModelID != nil {
		item.DefaultModelID = *po.DefaultModelID
	}
	if po.PublishedBy != nil {
		item.PublishedBy = *po.PublishedBy
	}
	return item
}

func articleTypeConfigDO(po *model.ArticleTypeVersion) *biz.ArticleTypeConfig {
	config := &biz.ArticleTypeConfig{ContentGoal: po.ContentGoal, TargetAudience: po.TargetAudience, Tone: po.Tone, RecommendedMinWords: po.RecommendedMinWords, RecommendedMaxWords: po.RecommendedMaxWords, SystemPrompt: po.SystemPrompt, UserPromptTemplate: po.UserPromptTemplate, OutputFormat: po.OutputFormat}
	if config.OutputFormat == 0 {
		config.OutputFormat = model.ArticleTypeOutputMarkdown
	}
	for _, row := range po.Sections {
		config.Sections = append(config.Sections, biz.ArticleTypeSection{Title: row.Title, Guidance: row.Guidance, Required: row.Required})
	}
	for _, row := range po.InputFields {
		field := biz.ArticleTypeInputField{Key: row.FieldKey, Label: row.Label, InputType: row.InputType, Required: row.Required, Placeholder: row.Placeholder, HelpText: row.HelpText, DefaultValue: row.DefaultValue}
		for _, option := range row.Options {
			field.Options = append(field.Options, option.OptionValue)
		}
		config.InputFields = append(config.InputFields, field)
	}
	for _, row := range po.Rules {
		switch row.RuleType {
		case model.ArticleTypeRuleGEO:
			config.GEORules = append(config.GEORules, row.RuleText)
		case model.ArticleTypeRuleQuality:
			config.QualityRules = append(config.QualityRules, row.RuleText)
		}
	}
	for _, row := range po.Models {
		config.WritingModelIDs = append(config.WritingModelIDs, row.WritingModelID)
		if row.IsDefault {
			config.DefaultWritingModelID = row.WritingModelID
		}
	}
	for _, row := range po.Channels {
		config.PublishChannelIDs = append(config.PublishChannelIDs, row.PublishChannelID)
	}
	loadLegacyArticleTypeConfig(config, po)
	return config
}

func loadLegacyArticleTypeConfig(config *biz.ArticleTypeConfig, po *model.ArticleTypeVersion) {
	if len(config.Sections) == 0 {
		_ = json.Unmarshal(po.StructureJSON, &config.Sections)
	}
	if len(config.InputFields) == 0 {
		_ = json.Unmarshal(po.InputSchemaJSON, &config.InputFields)
	}
	if len(config.GEORules) == 0 {
		_ = json.Unmarshal(po.GEORulesJSON, &config.GEORules)
	}
	if len(config.QualityRules) == 0 {
		_ = json.Unmarshal(po.QualityRulesJSON, &config.QualityRules)
	}
	if len(config.WritingModelIDs) == 0 {
		_ = json.Unmarshal(po.FallbackModelIDsJSON, &config.WritingModelIDs)
	}
	if config.DefaultWritingModelID == 0 && po.DefaultModelID != nil {
		config.DefaultWritingModelID = *po.DefaultModelID
	}
}

func mapArticleTypeError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return biz.ErrArticleTypeNotFound
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return biz.ErrArticleTypeConflict
	}
	return err
}
