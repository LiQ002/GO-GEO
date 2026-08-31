package service

import (
	"context"

	v1 "kratos-svr/api/user/v1"
	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/authn"
	"kratos-svr/internal/query"

	"google.golang.org/protobuf/types/known/timestamppb"
)

type ArticleGenerationService struct {
	v1.UnimplementedArticleGenerationServiceServer
	usecase *biz.ArticleGenerationUsecase
}

func NewArticleGenerationService(usecase *biz.ArticleGenerationUsecase) *ArticleGenerationService {
	return &ArticleGenerationService{usecase: usecase}
}

func (s *ArticleGenerationService) CreateArticleGeneration(ctx context.Context, req *v1.CreateArticleGenerationRequest) (*v1.ArticleGenerationTask, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return nil, err
	}
	principal, ok := authn.PrincipalFromContext(ctx)
	if !ok || principal.SubjectID == 0 {
		return nil, biz.ErrArticleGenerationInvalid
	}
	task, err := s.usecase.Create(ctx, biz.ArticleGenerationInput{
		EnterpriseID:         enterpriseID,
		OperatorID:           principal.SubjectID,
		ClientRequestID:      req.GetClientRequestId(),
		ArticleID:            req.GetArticleId(),
		BrandID:              req.GetBrandId(),
		ArticleTypeID:        req.GetArticleTypeId(),
		ArticleTypeVersionID: req.GetArticleTypeVersionId(),
		WritingModelID:       req.GetWritingModelId(),
		KeywordID:            req.GetKeywordId(),
		QuestionID:           req.GetQuestionId(),
		KnowledgeBaseIDs:     req.GetKnowledgeBaseIds(),
		KnowledgeDocumentIDs: req.GetKnowledgeDocumentIds(),
		GalleryAlbumIDs:      req.GetGalleryAlbumIds(),
		GalleryImageCount:    req.GetGalleryImageCount(),
		InputJSON:            req.GetInputJson(),
		UserInstruction:      req.GetUserInstruction(),
	})
	if err != nil {
		return nil, err
	}
	return articleGenerationDTO(task), nil
}

func (s *ArticleGenerationService) GetArticleGeneration(ctx context.Context, req *v1.GetArticleGenerationRequest) (*v1.ArticleGenerationTask, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return nil, err
	}
	task, err := s.usecase.Get(ctx, enterpriseID, req.GetId())
	if err != nil {
		return nil, err
	}
	return articleGenerationDTO(task), nil
}

func (s *ArticleGenerationService) ListArticleGenerations(ctx context.Context, req *v1.ListArticleGenerationsRequest) (*v1.ListArticleGenerationsReply, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return nil, err
	}
	page, err := parseUserPage(req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, biz.ErrArticleGenerationInvalid
	}
	items, total, err := s.usecase.List(ctx, enterpriseID, biz.ArticleGenerationListOptions{
		Offset:    page.Offset,
		Limit:     page.Limit,
		Status:    req.GetStatus(),
		ArticleID: req.GetArticleId(),
	})
	if err != nil {
		return nil, err
	}
	reply := &v1.ListArticleGenerationsReply{Items: make([]*v1.ArticleGenerationTask, 0, len(items)), TotalSize: total}
	for _, item := range items {
		reply.Items = append(reply.Items, articleGenerationDTO(item))
	}
	if page.Offset+len(items) < int(total) {
		reply.NextPageToken = query.NextToken(page.Offset + len(items))
	}
	return reply, nil
}

func (s *ArticleGenerationService) RetryArticleGeneration(ctx context.Context, req *v1.RetryArticleGenerationRequest) (*v1.ArticleGenerationTask, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return nil, err
	}
	task, err := s.usecase.Retry(ctx, enterpriseID, req.GetId())
	if err != nil {
		return nil, err
	}
	return articleGenerationDTO(task), nil
}

func articleGenerationDTO(task *biz.ArticleGenerationTask) *v1.ArticleGenerationTask {
	if task == nil {
		return nil
	}
	item := &v1.ArticleGenerationTask{
		Id:                     task.ID,
		ArticleId:              task.ArticleID,
		ArticleTypeVersionId:   task.ArticleTypeVersionID,
		PromptVersionId:        task.PromptVersionID,
		WritingModelId:         task.WritingModelID,
		WritingModelVersion:    task.WritingModelVersion,
		ClientRequestId:        task.ClientRequestID,
		Status:                 task.Status,
		InputJson:              task.InputJSON,
		OutputJson:             task.OutputJSON,
		InputTokens:            task.InputTokens,
		OutputTokens:           task.OutputTokens,
		CostMicros:             task.CostMicros,
		ErrorCode:              task.ErrorCode,
		ErrorMessage:           task.ErrorMessage,
		AttemptCount:           task.AttemptCount,
		ResultArticleVersionId: task.ResultArticleVersionID,
		ResultSnapshotId:       task.ResultSnapshotID,
		CreatedAt:              timestamppb.New(task.CreatedAt),
		UpdatedAt:              timestamppb.New(task.UpdatedAt),
	}
	if task.StartedAt != nil {
		item.StartedAt = timestamppb.New(*task.StartedAt)
	}
	if task.CompletedAt != nil {
		item.CompletedAt = timestamppb.New(*task.CompletedAt)
	}
	return item
}
