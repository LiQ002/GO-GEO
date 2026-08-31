package data

import (
	"context"
	"encoding/json"

	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/data/model"

	"gorm.io/gorm"
)

type catalogRepo struct{ data *Data }

func NewCatalogRepo(d *Data) biz.CatalogRepo { return &catalogRepo{data: d} }
func (r *catalogRepo) ListArticleTypes(c context.Context, _ uint64) ([]*biz.ArticleTypeCatalogItem, error) {
	var rows []model.ArticleType
	if x := r.data.DB(c).Where("status = ? AND visible = ? AND current_version_id IS NOT NULL", model.ArticleTypeStatusActive, true).Order("sort_order ASC").Find(&rows).Error; x != nil {
		return nil, x
	}
	versionIDs := make([]uint64, 0, len(rows))
	for i := range rows {
		versionIDs = append(versionIDs, *rows[i].CurrentVersionID)
	}
	versions, err := loadCatalogArticleTypeVersions(r.data.DB(c), versionIDs)
	if err != nil {
		return nil, err
	}
	out := make([]*biz.ArticleTypeCatalogItem, 0, len(rows))
	for _, i := range rows {
		version := versions[*i.CurrentVersionID]
		if version == nil {
			continue
		}
		out = append(out, &biz.ArticleTypeCatalogItem{ID: i.ID, CurrentVersionID: version.ID, ConfigRevision: version.VersionNumber, Code: i.Code, Name: i.Name, Description: i.Description, Icon: i.Icon, Config: catalogArticleTypeConfig(version)})
	}
	return out, nil
}
func (r *catalogRepo) ListWritingModels(c context.Context, e uint64) ([]*biz.CatalogItem, error) {
	var rows []model.WritingModel
	if x := r.data.DB(c).Where(model.TableWritingModels+".status = ?", model.WritingModelStatusActive).
		Where(writingModelAccessSQL, writingModelAccessArgs(e)...).
		Order(model.TableWritingModels + ".sort_order ASC").Find(&rows).Error; x != nil {
		return nil, x
	}
	modelIDs := make([]uint64, 0, len(rows))
	for _, row := range rows {
		modelIDs = append(modelIDs, row.ID)
	}
	purposesByModel := make(map[uint64][]int32, len(rows))
	if len(modelIDs) > 0 {
		var purposes []model.WritingModelPurpose
		if x := r.data.DB(c).Where("writing_model_id IN ?", modelIDs).Order("id ASC").Find(&purposes).Error; x != nil {
			return nil, x
		}
		for _, purpose := range purposes {
			purposesByModel[purpose.WritingModelID] = append(purposesByModel[purpose.WritingModelID], purpose.Purpose)
		}
	}
	out := make([]*biz.CatalogItem, 0, len(rows))
	for _, i := range rows {
		capabilities, _ := json.Marshal(purposesByModel[i.ID])
		display, _ := json.Marshal(map[string]any{
			"context_length": i.ContextLength,
			"temperature":    i.Temperature,
			"top_p":          i.TopP,
			"max_tokens":     i.MaxTokens,
		})
		out = append(out, &biz.CatalogItem{ID: i.ID, Code: i.Code, Name: i.DisplayName, Category: writingModelProviderCode(i.Provider), CapabilitiesJSON: string(capabilities), DisplayConfigJSON: string(display)})
	}
	return out, nil
}
func (r *catalogRepo) ListPublishChannels(c context.Context, _ uint64) ([]*biz.CatalogItem, error) {
	var rows []model.PublishChannel
	if x := r.data.DB(c).Where(model.TablePublishChannels+".status = ?", model.PublishChannelStatusActive).Order(model.TablePublishChannels + ".sort_order ASC").Find(&rows).Error; x != nil {
		return nil, x
	}
	out := make([]*biz.CatalogItem, 0, len(rows))
	for _, i := range rows {
		out = append(out, &biz.CatalogItem{ID: i.ID, Code: i.Code, DriverType: i.DriverType, LoginURL: i.LoginURL, Name: i.Name, Category: publishCategoryCode(i.Category), Description: i.Description, Icon: i.Icon, AccountRequired: i.AuthorizationType != model.AuthorizationTypeNone})
	}
	return out, nil
}
func (r *catalogRepo) ListPublishTargets(c context.Context, _, channelID uint64) ([]*biz.CatalogItem, error) {
	db := r.data.DB(c).Model(&model.PublishTarget{})
	db = db.Where(model.TablePublishTargets+".status = ?", model.PublishChannelStatusActive)
	if channelID != 0 {
		db = db.Where(model.TablePublishTargets+".publish_channel_id = ?", channelID)
	}
	var rows []model.PublishTarget
	if x := db.Order(model.TablePublishTargets + ".sort_order ASC").Find(&rows).Error; x != nil {
		return nil, x
	}
	out := make([]*biz.CatalogItem, 0, len(rows))
	for _, i := range rows {
		display, _ := json.Marshal(map[string]any{"platform": i.Platform, "entry_url": i.EntryURL, "region": i.Region, "industry": i.Industry})
		out = append(out, &biz.CatalogItem{ID: i.ID, ParentID: i.PublishChannelID, Name: i.Name, Category: publishCategoryCode(i.TargetType), DisplayConfigJSON: string(display)})
	}
	return out, nil
}
func (r *catalogRepo) ListInclusionSites(c context.Context, _ uint64) ([]*biz.CatalogItem, error) {
	var rows []model.InclusionSite
	if x := r.data.DB(c).Where(model.TableInclusionSites+".status = ?", model.PublishChannelStatusActive).Order(model.TableInclusionSites + ".sort_order ASC").Find(&rows).Error; x != nil {
		return nil, x
	}
	out := make([]*biz.CatalogItem, 0, len(rows))
	for _, i := range rows {
		loginURL := i.LoginURL
		if loginURL == "" {
			loginURL = i.EntryURL
		}
		out = append(out, &biz.CatalogItem{ID: i.ID, Code: i.Code, DriverType: i.DriverType, LoginURL: loginURL, Name: i.Name, Category: "inclusion_site", Icon: i.Icon, AccountRequired: true})
	}
	return out, nil
}

func loadCatalogArticleTypeVersions(db *gorm.DB, ids []uint64) (map[uint64]*model.ArticleTypeVersion, error) {
	out := make(map[uint64]*model.ArticleTypeVersion, len(ids))
	if len(ids) == 0 {
		return out, nil
	}
	var versions []*model.ArticleTypeVersion
	query := db.
		Preload("Sections", func(query *gorm.DB) *gorm.DB { return query.Order("sort_order ASC") }).
		Preload("InputFields", func(query *gorm.DB) *gorm.DB { return query.Order("sort_order ASC") }).
		Preload("InputFields.Options", func(query *gorm.DB) *gorm.DB { return query.Order("sort_order ASC") }).
		Preload("Models", func(query *gorm.DB) *gorm.DB { return query.Order("sort_order ASC") }).
		Preload("Channels", func(query *gorm.DB) *gorm.DB { return query.Order("sort_order ASC") })
	if err := query.Find(&versions, ids).Error; err != nil {
		return nil, err
	}
	for _, version := range versions {
		out[version.ID] = version
	}
	return out, nil
}

func catalogArticleTypeConfig(version *model.ArticleTypeVersion) *biz.ArticleTypeConfig {
	config := &biz.ArticleTypeConfig{ContentGoal: version.ContentGoal, TargetAudience: version.TargetAudience, Tone: version.Tone, RecommendedMinWords: version.RecommendedMinWords, RecommendedMaxWords: version.RecommendedMaxWords, OutputFormat: version.OutputFormat}
	if config.OutputFormat == 0 {
		config.OutputFormat = model.ArticleTypeOutputMarkdown
	}
	for _, row := range version.Sections {
		config.Sections = append(config.Sections, biz.ArticleTypeSection{Title: row.Title, Guidance: row.Guidance, Required: row.Required})
	}
	for _, row := range version.InputFields {
		field := biz.ArticleTypeInputField{Key: row.FieldKey, Label: row.Label, InputType: row.InputType, Required: row.Required, Placeholder: row.Placeholder, HelpText: row.HelpText, DefaultValue: row.DefaultValue}
		for _, option := range row.Options {
			field.Options = append(field.Options, option.OptionValue)
		}
		config.InputFields = append(config.InputFields, field)
	}
	for _, row := range version.Models {
		config.WritingModelIDs = append(config.WritingModelIDs, row.WritingModelID)
		if row.IsDefault {
			config.DefaultWritingModelID = row.WritingModelID
		}
	}
	for _, row := range version.Channels {
		config.PublishChannelIDs = append(config.PublishChannelIDs, row.PublishChannelID)
	}
	if len(config.Sections) == 0 {
		_ = json.Unmarshal(version.StructureJSON, &config.Sections)
	}
	if len(config.InputFields) == 0 {
		_ = json.Unmarshal(version.InputSchemaJSON, &config.InputFields)
	}
	if config.DefaultWritingModelID == 0 && version.DefaultModelID != nil {
		config.DefaultWritingModelID = *version.DefaultModelID
	}
	return config
}
