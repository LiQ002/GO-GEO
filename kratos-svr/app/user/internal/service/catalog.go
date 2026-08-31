package service

import (
	"context"
	commonv1 "kratos-svr/api/common/v1"
	v1 "kratos-svr/api/user/v1"
	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/authn"
)

type CatalogService struct {
	v1.UnimplementedCatalogServiceServer
	uc *biz.CatalogUsecase
}

func NewCatalogService(u *biz.CatalogUsecase) *CatalogService { return &CatalogService{uc: u} }
func (s *CatalogService) ListArticleTypeCatalog(c context.Context, _ *v1.ListArticleTypeCatalogRequest) (*v1.ListArticleTypeCatalogReply, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	i, x := s.uc.ListArticleTypes(c, e)
	if x != nil {
		return nil, x
	}
	return &v1.ListArticleTypeCatalogReply{Items: articleTypeCatalogDTO(i)}, nil
}
func (s *CatalogService) ListWritingModelCatalog(c context.Context, _ *v1.ListWritingModelCatalogRequest) (*v1.ListWritingModelCatalogReply, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	i, x := s.uc.ListWritingModels(c, e)
	if x != nil {
		return nil, x
	}
	return &v1.ListWritingModelCatalogReply{Items: catalogDTO(i)}, nil
}
func (s *CatalogService) ListPublishChannelCatalog(c context.Context, _ *v1.ListPublishChannelCatalogRequest) (*v1.ListPublishChannelCatalogReply, error) {
	i, x := s.listPublishChannels(c)
	if x != nil {
		return nil, x
	}
	return &v1.ListPublishChannelCatalogReply{Items: catalogDTO(i)}, nil
}
func (s *CatalogService) ListPublishChannels(c context.Context, _ *v1.ListPublishChannelsRequest) (*v1.ListPublishChannelsReply, error) {
	i, x := s.listPublishChannels(c)
	if x != nil {
		return nil, x
	}
	return &v1.ListPublishChannelsReply{Items: catalogDTO(i)}, nil
}
func (s *CatalogService) listPublishChannels(c context.Context) ([]*biz.CatalogItem, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	return s.uc.ListPublishChannels(c, e)
}
func (s *CatalogService) ListPublishTargetCatalog(c context.Context, r *v1.ListPublishTargetCatalogRequest) (*v1.ListPublishTargetCatalogReply, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	i, x := s.uc.ListPublishTargets(c, e, r.GetPublishChannelId())
	if x != nil {
		return nil, x
	}
	return &v1.ListPublishTargetCatalogReply{Items: catalogDTO(i)}, nil
}
func (s *CatalogService) ListInclusionSiteCatalog(c context.Context, _ *v1.ListInclusionSiteCatalogRequest) (*v1.ListInclusionSiteCatalogReply, error) {
	i, x := s.listInclusionSites(c)
	if x != nil {
		return nil, x
	}
	return &v1.ListInclusionSiteCatalogReply{Items: catalogDTO(i)}, nil
}
func (s *CatalogService) ListInclusionSites(c context.Context, _ *v1.ListInclusionSitesRequest) (*v1.ListInclusionSitesReply, error) {
	i, x := s.listInclusionSites(c)
	if x != nil {
		return nil, x
	}
	return &v1.ListInclusionSitesReply{Items: catalogDTO(i)}, nil
}
func (s *CatalogService) listInclusionSites(c context.Context) ([]*biz.CatalogItem, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	return s.uc.ListInclusionSites(c, e)
}
func catalogDTO(items []*biz.CatalogItem) []*v1.CatalogItem {
	out := make([]*v1.CatalogItem, 0, len(items))
	for _, i := range items {
		out = append(out, &v1.CatalogItem{Id: i.ID, Code: i.Code, DriverType: i.DriverType, LoginUrl: i.LoginURL, Name: i.Name, Category: i.Category, Description: i.Description, Icon: i.Icon, CapabilitiesJson: i.CapabilitiesJSON, DisplayConfigJson: i.DisplayConfigJSON, CurrentVersionId: i.CurrentVersionID, AccountRequired: i.AccountRequired, ParentId: i.ParentID})
	}
	return out
}

func articleTypeCatalogDTO(items []*biz.ArticleTypeCatalogItem) []*v1.ArticleTypeCatalogItem {
	out := make([]*v1.ArticleTypeCatalogItem, 0, len(items))
	for _, item := range items {
		out = append(out, &v1.ArticleTypeCatalogItem{Id: item.ID, Code: item.Code, Name: item.Name, Description: item.Description, Icon: item.Icon, ConfigRevision: item.ConfigRevision, Config: userArticleTypeConfigDTO(item.Config)})
	}
	return out
}

func userArticleTypeConfigDTO(item *biz.ArticleTypeConfig) *v1.ArticleTypePublicConfig {
	if item == nil {
		return nil
	}
	config := &v1.ArticleTypePublicConfig{ContentGoal: item.ContentGoal, TargetAudience: item.TargetAudience, Tone: item.Tone, RecommendedMinWords: item.RecommendedMinWords, RecommendedMaxWords: item.RecommendedMaxWords, OutputFormat: item.OutputFormat, WritingModelIds: append([]uint64(nil), item.WritingModelIDs...), DefaultWritingModelId: item.DefaultWritingModelID, PublishChannelIds: append([]uint64(nil), item.PublishChannelIDs...)}
	for _, section := range item.Sections {
		config.Sections = append(config.Sections, &commonv1.ArticleTypeSection{Title: section.Title, Guidance: section.Guidance, Required: section.Required})
	}
	for _, field := range item.InputFields {
		config.InputFields = append(config.InputFields, &commonv1.ArticleTypeInputField{Key: field.Key, Label: field.Label, InputType: field.InputType, Required: field.Required, Placeholder: field.Placeholder, HelpText: field.HelpText, Options: append([]string(nil), field.Options...), DefaultValue: field.DefaultValue})
	}
	return config
}
