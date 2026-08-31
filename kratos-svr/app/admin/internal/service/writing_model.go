package service

import (
	"context"

	v1 "kratos-svr/api/admin/v1"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/query"

	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type WritingModelService struct {
	v1.UnimplementedWritingModelServiceServer
	uc *biz.WritingModelUsecase
}

func NewWritingModelService(uc *biz.WritingModelUsecase) *WritingModelService {
	return &WritingModelService{uc: uc}
}

func (s *WritingModelService) CreateWritingModel(ctx context.Context, req *v1.CreateWritingModelRequest) (*v1.WritingModel, error) {
	item := writingModelDO(req.GetWritingModel())
	if item != nil {
		item.APIKey = req.GetApiKey()
	}
	out, err := s.uc.Create(ctx, item)
	if err != nil {
		return nil, err
	}
	return writingModelDTO(out), nil
}
func (s *WritingModelService) GetWritingModel(ctx context.Context, req *v1.GetWritingModelRequest) (*v1.WritingModel, error) {
	out, err := s.uc.Get(ctx, req.GetId())
	if err != nil {
		return nil, err
	}
	return writingModelDTO(out), nil
}
func (s *WritingModelService) ListWritingModels(ctx context.Context, req *v1.ListWritingModelsRequest) (*v1.ListWritingModelsReply, error) {
	page, err := query.ParsePage(req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, biz.ErrWritingModelInvalid
	}
	items, total, err := s.uc.List(ctx, biz.WritingModelListOptions{Offset: page.Offset, Limit: page.Limit, Provider: req.GetProvider(), Status: req.GetStatus(), Keyword: req.GetKeyword()})
	if err != nil {
		return nil, err
	}
	reply := &v1.ListWritingModelsReply{Items: make([]*v1.WritingModel, 0, len(items)), TotalSize: total}
	for _, item := range items {
		reply.Items = append(reply.Items, writingModelDTO(item))
	}
	if page.Offset+len(items) < int(total) {
		reply.NextPageToken = query.NextToken(page.Offset + len(items))
	}
	return reply, nil
}
func (s *WritingModelService) UpdateWritingModel(ctx context.Context, req *v1.UpdateWritingModelRequest) (*v1.WritingModel, error) {
	item := writingModelDO(req.GetWritingModel())
	if item != nil {
		item.APIKey = req.GetReplacementApiKey()
	}
	out, err := s.uc.Update(ctx, item)
	if err != nil {
		return nil, err
	}
	return writingModelDTO(out), nil
}
func (s *WritingModelService) DeleteWritingModel(ctx context.Context, req *v1.DeleteWritingModelRequest) (*emptypb.Empty, error) {
	if err := s.uc.Delete(ctx, req.GetId(), req.GetVersion()); err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}
func (s *WritingModelService) TestWritingModel(ctx context.Context, req *v1.TestWritingModelRequest) (*v1.TestWritingModelReply, error) {
	result, err := s.uc.Test(ctx, req.GetId(), req.GetPrompt())
	if err != nil {
		return nil, err
	}
	return &v1.TestWritingModelReply{Success: result.Success, LatencyMs: result.LatencyMS, ResponsePreview: result.ResponsePreview, ErrorCode: result.ErrorCode}, nil
}

func writingModelDO(item *v1.WritingModel) *biz.WritingModel {
	if item == nil {
		return nil
	}
	return &biz.WritingModel{
		ID: item.GetId(), Code: item.GetCode(), DisplayName: item.GetDisplayName(), Provider: item.GetProvider(),
		Protocol: item.GetProtocol(), BaseURL: item.GetBaseUrl(), ModelID: item.GetModelId(),
		CredentialConfigured: item.GetCredentialConfigured(), ContextLength: item.GetContextLength(),
		Status: item.GetStatus(), SortOrder: item.GetSortOrder(), Purposes: item.GetPurposes(),
		Temperature: item.GetTemperature(), TopP: item.GetTopP(), MaxTokens: item.GetMaxTokens(),
		TimeoutSeconds: item.GetTimeoutSeconds(), CitationCapability: item.GetCitationCapability(),
		DiagnosisAPIMode: item.GetDiagnosisApiMode(), DiagnosisWebSearchEnabled: item.GetDiagnosisWebSearchEnabled(),
		SafetyEnabled:          item.GetSafetyEnabled(),
		InputModerationEnabled: item.GetInputModerationEnabled(), OutputModerationEnabled: item.GetOutputModerationEnabled(),
		SafetyFailClosed: item.GetSafetyFailClosed(), BlockedSafetyCategories: item.GetBlockedSafetyCategories(),
		InputPriceMicrosPerMillionTokens:  item.GetInputPriceMicrosPerMillionTokens(),
		OutputPriceMicrosPerMillionTokens: item.GetOutputPriceMicrosPerMillionTokens(),
		PriceCurrency:                     item.GetPriceCurrency(), AccessScope: item.GetAccessScope(),
		VisiblePlanIDs: item.GetVisiblePlanIds(), VisibleEnterpriseIDs: item.GetVisibleEnterpriseIds(), Version: item.GetVersion(),
	}
}
func writingModelDTO(item *biz.WritingModel) *v1.WritingModel {
	if item == nil {
		return nil
	}
	return &v1.WritingModel{
		Id: item.ID, Code: item.Code, DisplayName: item.DisplayName, Provider: item.Provider,
		Protocol: item.Protocol, BaseUrl: item.BaseURL, ModelId: item.ModelID,
		CredentialConfigured: item.CredentialConfigured, ContextLength: item.ContextLength,
		Status: item.Status, SortOrder: item.SortOrder, Purposes: item.Purposes,
		Temperature: item.Temperature, TopP: item.TopP, MaxTokens: item.MaxTokens,
		TimeoutSeconds: item.TimeoutSeconds, CitationCapability: item.CitationCapability,
		DiagnosisApiMode: item.DiagnosisAPIMode, DiagnosisWebSearchEnabled: item.DiagnosisWebSearchEnabled,
		SafetyEnabled:          item.SafetyEnabled,
		InputModerationEnabled: item.InputModerationEnabled, OutputModerationEnabled: item.OutputModerationEnabled,
		SafetyFailClosed: item.SafetyFailClosed, BlockedSafetyCategories: item.BlockedSafetyCategories,
		InputPriceMicrosPerMillionTokens:  item.InputPriceMicrosPerMillionTokens,
		OutputPriceMicrosPerMillionTokens: item.OutputPriceMicrosPerMillionTokens,
		PriceCurrency:                     item.PriceCurrency, AccessScope: item.AccessScope,
		VisiblePlanIds: item.VisiblePlanIDs, VisibleEnterpriseIds: item.VisibleEnterpriseIDs,
		Version: item.Version, CreatedAt: timestamppb.New(item.CreatedAt), UpdatedAt: timestamppb.New(item.UpdatedAt),
	}
}
