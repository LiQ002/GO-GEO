package service

import (
	"context"

	v1 "kratos-svr/api/admin/v1"
	commonv1 "kratos-svr/api/common/v1"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/authn"
	"kratos-svr/internal/query"

	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type ArticleTypeService struct {
	v1.UnimplementedArticleTypeServiceServer
	uc *biz.ArticleTypeUsecase
}

func NewArticleTypeService(uc *biz.ArticleTypeUsecase) *ArticleTypeService {
	return &ArticleTypeService{uc: uc}
}

func (s *ArticleTypeService) CreateArticleType(ctx context.Context, req *v1.CreateArticleTypeRequest) (*v1.ArticleType, error) {
	input := articleTypeDO(req.GetArticleType())
	if principal, ok := authn.PrincipalFromContext(ctx); ok && input != nil {
		input.PublishedBy = principal.SubjectID
	}
	item, err := s.uc.Create(ctx, input)
	if err != nil {
		return nil, err
	}
	return articleTypeDTO(item), nil
}

func (s *ArticleTypeService) GetArticleType(ctx context.Context, req *v1.GetArticleTypeRequest) (*v1.ArticleType, error) {
	item, err := s.uc.Get(ctx, req.GetId())
	if err != nil {
		return nil, err
	}
	return articleTypeDTO(item), nil
}

func (s *ArticleTypeService) ListArticleTypes(ctx context.Context, req *v1.ListArticleTypesRequest) (*v1.ListArticleTypesReply, error) {
	page, err := query.ParsePage(req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, biz.ErrArticleTypeInvalid
	}
	var visible *bool
	if req.Visible != nil {
		value := req.GetVisible()
		visible = &value
	}
	items, total, err := s.uc.List(ctx, biz.ArticleTypeListOptions{
		Offset: page.Offset, Limit: page.Limit, Status: req.GetStatus(), SourceType: req.GetSourceType(), Keyword: req.GetKeyword(), Visible: visible,
	})
	if err != nil {
		return nil, err
	}
	reply := &v1.ListArticleTypesReply{Items: make([]*v1.ArticleType, 0, len(items)), TotalSize: total}
	for _, item := range items {
		reply.Items = append(reply.Items, articleTypeDTO(item))
	}
	if page.Offset+len(items) < int(total) {
		reply.NextPageToken = query.NextToken(page.Offset + len(items))
	}
	return reply, nil
}

func (s *ArticleTypeService) UpdateArticleType(ctx context.Context, req *v1.UpdateArticleTypeRequest) (*v1.ArticleType, error) {
	input := articleTypeDO(req.GetArticleType())
	if principal, ok := authn.PrincipalFromContext(ctx); ok && input != nil {
		input.PublishedBy = principal.SubjectID
	}
	item, err := s.uc.Update(ctx, input)
	if err != nil {
		return nil, err
	}
	return articleTypeDTO(item), nil
}

func (s *ArticleTypeService) DeleteArticleType(ctx context.Context, req *v1.DeleteArticleTypeRequest) (*emptypb.Empty, error) {
	if err := s.uc.Delete(ctx, req.GetId(), req.GetVersion()); err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}

func (s *ArticleTypeService) CreateArticleTypeVersion(ctx context.Context, req *v1.CreateArticleTypeVersionRequest) (*v1.ArticleTypeVersion, error) {
	version := articleTypeVersionDO(req.GetVersion())
	if version == nil {
		return nil, biz.ErrArticleTypeInvalid
	}
	version.ArticleTypeID = req.GetArticleTypeId()
	if principal, ok := authn.PrincipalFromContext(ctx); ok {
		version.PublishedBy = principal.SubjectID
	}
	item, err := s.uc.CreateVersion(ctx, version)
	if err != nil {
		return nil, err
	}
	return articleTypeVersionDTO(item), nil
}

func (s *ArticleTypeService) ListArticleTypeVersions(ctx context.Context, req *v1.ListArticleTypeVersionsRequest) (*v1.ListArticleTypeVersionsReply, error) {
	items, err := s.uc.ListVersions(ctx, req.GetArticleTypeId())
	if err != nil {
		return nil, err
	}
	reply := &v1.ListArticleTypeVersionsReply{Items: make([]*v1.ArticleTypeVersion, 0, len(items))}
	for _, item := range items {
		reply.Items = append(reply.Items, articleTypeVersionDTO(item))
	}
	return reply, nil
}

func (s *ArticleTypeService) PublishArticleTypeVersion(ctx context.Context, req *v1.PublishArticleTypeVersionRequest) (*v1.ArticleType, error) {
	item, err := s.uc.SetCurrentVersion(ctx, req.GetArticleTypeId(), req.GetVersionId(), req.GetExpectedVersion())
	if err != nil {
		return nil, err
	}
	return articleTypeDTO(item), nil
}

func (s *ArticleTypeService) RollbackArticleType(ctx context.Context, req *v1.RollbackArticleTypeRequest) (*v1.ArticleType, error) {
	item, err := s.uc.SetCurrentVersion(ctx, req.GetArticleTypeId(), req.GetVersionId(), req.GetExpectedVersion())
	if err != nil {
		return nil, err
	}
	return articleTypeDTO(item), nil
}

func articleTypeDO(item *v1.ArticleType) *biz.ArticleType {
	if item == nil {
		return nil
	}
	return &biz.ArticleType{ID: item.GetId(), Code: item.GetCode(), Name: item.GetName(), Description: item.GetDescription(), Icon: item.GetIcon(), SourceType: item.GetSourceType(), Status: item.GetStatus(), Visible: item.GetVisible(), SortOrder: item.GetSortOrder(), CurrentVersionID: item.GetCurrentVersionId(), VisibilityJSON: item.GetVisibilityJson(), Version: item.GetVersion(), ConfigRevision: item.GetConfigRevision(), ConfigChangeSummary: item.GetConfigChangeSummary(), Config: articleTypeConfigDO(item.GetConfig())}
}

func articleTypeDTO(item *biz.ArticleType) *v1.ArticleType {
	if item == nil {
		return nil
	}
	return &v1.ArticleType{Id: item.ID, Code: item.Code, Name: item.Name, Description: item.Description, Icon: item.Icon, SourceType: item.SourceType, Status: item.Status, Visible: item.Visible, SortOrder: item.SortOrder, CurrentVersionId: item.CurrentVersionID, VisibilityJson: item.VisibilityJSON, Version: item.Version, Config: articleTypeConfigDTO(item.Config), ConfigRevision: item.ConfigRevision, ConfigChangeSummary: item.ConfigChangeSummary, CreatedAt: timestamppb.New(item.CreatedAt), UpdatedAt: timestamppb.New(item.UpdatedAt)}
}

func articleTypeVersionDO(item *v1.ArticleTypeVersion) *biz.ArticleTypeVersion {
	if item == nil {
		return nil
	}
	return &biz.ArticleTypeVersion{ID: item.GetId(), ArticleTypeID: item.GetArticleTypeId(), VersionNumber: item.GetVersionNumber(), Status: item.GetStatus(), ContentGoal: item.GetContentGoal(), TargetAudience: item.GetTargetAudience(), Tone: item.GetTone(), RecommendedMinWords: item.GetRecommendedMinWords(), RecommendedMaxWords: item.GetRecommendedMaxWords(), StructureJSON: item.GetStructureJson(), InputSchemaJSON: item.GetInputSchemaJson(), GEORulesJSON: item.GetGeoRulesJson(), QualityRulesJSON: item.GetQualityRulesJson(), PromptVersionID: item.GetPromptVersionId(), DefaultModelID: item.GetDefaultModelId(), FallbackModelIDsJSON: item.GetFallbackModelIdsJson(), ChangeSummary: item.GetChangeSummary(), Config: articleTypeConfigDO(item.GetConfig()), PublishedBy: item.GetPublishedBy()}
}

func articleTypeVersionDTO(item *biz.ArticleTypeVersion) *v1.ArticleTypeVersion {
	if item == nil {
		return nil
	}
	return &v1.ArticleTypeVersion{Id: item.ID, ArticleTypeId: item.ArticleTypeID, VersionNumber: item.VersionNumber, Status: item.Status, ContentGoal: item.ContentGoal, TargetAudience: item.TargetAudience, Tone: item.Tone, RecommendedMinWords: item.RecommendedMinWords, RecommendedMaxWords: item.RecommendedMaxWords, StructureJson: item.StructureJSON, InputSchemaJson: item.InputSchemaJSON, GeoRulesJson: item.GEORulesJSON, QualityRulesJson: item.QualityRulesJSON, PromptVersionId: item.PromptVersionID, DefaultModelId: item.DefaultModelID, FallbackModelIdsJson: item.FallbackModelIDsJSON, ChangeSummary: item.ChangeSummary, Config: articleTypeConfigDTO(item.Config), PublishedBy: item.PublishedBy, CreatedAt: timestamppb.New(item.CreatedAt)}
}

func articleTypeConfigDO(item *commonv1.ArticleTypeConfig) *biz.ArticleTypeConfig {
	if item == nil {
		return nil
	}
	config := &biz.ArticleTypeConfig{ContentGoal: item.GetContentGoal(), TargetAudience: item.GetTargetAudience(), Tone: item.GetTone(), RecommendedMinWords: item.GetRecommendedMinWords(), RecommendedMaxWords: item.GetRecommendedMaxWords(), GEORules: append([]string(nil), item.GetGeoRules()...), QualityRules: append([]string(nil), item.GetQualityRules()...), SystemPrompt: item.GetSystemPrompt(), UserPromptTemplate: item.GetUserPromptTemplate(), OutputFormat: item.GetOutputFormat(), WritingModelIDs: append([]uint64(nil), item.GetWritingModelIds()...), DefaultWritingModelID: item.GetDefaultWritingModelId(), PublishChannelIDs: append([]uint64(nil), item.GetPublishChannelIds()...)}
	for _, section := range item.GetSections() {
		config.Sections = append(config.Sections, biz.ArticleTypeSection{Title: section.GetTitle(), Guidance: section.GetGuidance(), Required: section.GetRequired()})
	}
	for _, field := range item.GetInputFields() {
		config.InputFields = append(config.InputFields, biz.ArticleTypeInputField{Key: field.GetKey(), Label: field.GetLabel(), InputType: field.GetInputType(), Required: field.GetRequired(), Placeholder: field.GetPlaceholder(), HelpText: field.GetHelpText(), Options: append([]string(nil), field.GetOptions()...), DefaultValue: field.GetDefaultValue()})
	}
	return config
}

func articleTypeConfigDTO(item *biz.ArticleTypeConfig) *commonv1.ArticleTypeConfig {
	if item == nil {
		return nil
	}
	config := &commonv1.ArticleTypeConfig{ContentGoal: item.ContentGoal, TargetAudience: item.TargetAudience, Tone: item.Tone, RecommendedMinWords: item.RecommendedMinWords, RecommendedMaxWords: item.RecommendedMaxWords, GeoRules: append([]string(nil), item.GEORules...), QualityRules: append([]string(nil), item.QualityRules...), SystemPrompt: item.SystemPrompt, UserPromptTemplate: item.UserPromptTemplate, OutputFormat: item.OutputFormat, WritingModelIds: append([]uint64(nil), item.WritingModelIDs...), DefaultWritingModelId: item.DefaultWritingModelID, PublishChannelIds: append([]uint64(nil), item.PublishChannelIDs...)}
	for _, section := range item.Sections {
		config.Sections = append(config.Sections, &commonv1.ArticleTypeSection{Title: section.Title, Guidance: section.Guidance, Required: section.Required})
	}
	for _, field := range item.InputFields {
		config.InputFields = append(config.InputFields, &commonv1.ArticleTypeInputField{Key: field.Key, Label: field.Label, InputType: field.InputType, Required: field.Required, Placeholder: field.Placeholder, HelpText: field.HelpText, Options: append([]string(nil), field.Options...), DefaultValue: field.DefaultValue})
	}
	return config
}
