package service

import (
	"context"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
	v1 "kratos-svr/api/user/v1"
	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/authn"
	"kratos-svr/internal/query"
	"strings"
)

type KeywordService struct {
	v1.UnimplementedKeywordServiceServer
	uc           *biz.KeywordUsecase
	distillation *biz.KeywordDistillationUsecase
}

func NewKeywordService(u *biz.KeywordUsecase, distillation *biz.KeywordDistillationUsecase) *KeywordService {
	return &KeywordService{uc: u, distillation: distillation}
}
func (s *KeywordService) CreateKeyword(c context.Context, r *v1.CreateKeywordRequest) (*v1.Keyword, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	principal, hasPrincipal := authn.PrincipalFromContext(c)
	if r.GetDistillQuestionCount() > 100 || (r.GetDistillQuestionCount() > 0 && (strings.TrimSpace(r.GetClientRequestId()) == "" || !hasPrincipal || principal.SubjectID == 0)) {
		return nil, biz.ErrKeywordDistillationInvalid
	}
	i := keywordDO(r.GetKeyword())
	if i != nil {
		i.EnterpriseID = e
		i.RequestedQuestionCount = r.GetDistillQuestionCount()
		i.DistillationStatus = biz.KeywordDistillationStatusPending
	}
	o, x := s.uc.Create(c, i)
	if x != nil {
		return nil, x
	}
	if r.GetDistillQuestionCount() == 0 {
		return keywordDTO(o), nil
	}
	_, distillErr := s.distillation.Create(c, biz.KeywordDistillationInput{
		EnterpriseID: e, OperatorID: principal.SubjectID, KeywordID: o.ID,
		WritingModelID: r.GetWritingModelId(), ClientRequestID: r.GetClientRequestId(),
		Region: o.Region, QuestionCount: r.GetDistillQuestionCount(),
	})
	if distillErr != nil {
		o, x = s.uc.MarkDistillationFailed(c, e, o.ID, r.GetDistillQuestionCount(), distillErr.Error())
		if x != nil {
			return nil, x
		}
		return keywordDTO(o), nil
	}
	o, x = s.uc.Get(c, e, o.ID)
	if x != nil {
		return nil, x
	}
	return keywordDTO(o), nil
}
func (s *KeywordService) DistillKeywordQuestions(c context.Context, r *v1.DistillKeywordQuestionsRequest) (*v1.KeywordDistillationTask, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	principal, ok := authn.PrincipalFromContext(c)
	if !ok || principal.SubjectID == 0 {
		return nil, biz.ErrKeywordDistillationInvalid
	}
	task, x := s.distillation.Create(c, biz.KeywordDistillationInput{
		EnterpriseID: e, OperatorID: principal.SubjectID, KeywordID: r.GetKeywordId(),
		WritingModelID: r.GetWritingModelId(), ClientRequestID: r.GetClientRequestId(),
		Region: r.GetRegion(), QuestionCount: r.GetQuestionCount(),
	})
	if x != nil {
		return nil, x
	}
	return keywordDistillationDTO(task), nil
}
func (s *KeywordService) ListKeywordDistillations(c context.Context, r *v1.ListKeywordDistillationsRequest) (*v1.ListKeywordDistillationsReply, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	p, x := parseUserPage(r.GetPageSize(), r.GetPageToken())
	if x != nil {
		return nil, biz.ErrKeywordDistillationInvalid
	}
	items, total, x := s.distillation.List(c, e, biz.KeywordDistillationListOptions{Offset: p.Offset, Limit: p.Limit, KeywordID: r.GetKeywordId(), Status: r.GetStatus()})
	if x != nil {
		return nil, x
	}
	reply := &v1.ListKeywordDistillationsReply{Items: make([]*v1.KeywordDistillationTask, 0, len(items)), TotalSize: total}
	for _, item := range items {
		reply.Items = append(reply.Items, keywordDistillationDTO(item))
	}
	if p.Offset+len(items) < int(total) {
		reply.NextPageToken = query.NextToken(p.Offset + len(items))
	}
	return reply, nil
}
func (s *KeywordService) RetryKeywordDistillation(c context.Context, r *v1.RetryKeywordDistillationRequest) (*v1.KeywordDistillationTask, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	task, x := s.distillation.Retry(c, e, r.GetId())
	if x != nil {
		return nil, x
	}
	return keywordDistillationDTO(task), nil
}
func (s *KeywordService) GetKeyword(c context.Context, r *v1.GetKeywordRequest) (*v1.Keyword, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	o, x := s.uc.Get(c, e, r.GetId())
	if x != nil {
		return nil, x
	}
	return keywordDTO(o), nil
}
func (s *KeywordService) ListKeywords(c context.Context, r *v1.ListKeywordsRequest) (*v1.ListKeywordsReply, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	p, x := parseUserPage(r.GetPageSize(), r.GetPageToken())
	if x != nil {
		return nil, biz.ErrKeywordInvalid
	}
	items, total, x := s.uc.List(c, e, biz.KeywordListOptions{Offset: p.Offset, Limit: p.Limit, BrandID: r.GetBrandId(), Status: r.GetStatus(), Keyword: r.GetKeyword()})
	if x != nil {
		return nil, x
	}
	o := &v1.ListKeywordsReply{Items: make([]*v1.Keyword, 0, len(items)), TotalSize: total}
	for _, i := range items {
		o.Items = append(o.Items, keywordDTO(i))
	}
	if p.Offset+len(items) < int(total) {
		o.NextPageToken = query.NextToken(p.Offset + len(items))
	}
	return o, nil
}
func (s *KeywordService) UpdateKeyword(c context.Context, r *v1.UpdateKeywordRequest) (*v1.Keyword, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	i := keywordDO(r.GetKeyword())
	if i != nil {
		i.EnterpriseID = e
	}
	o, x := s.uc.Update(c, i)
	if x != nil {
		return nil, x
	}
	return keywordDTO(o), nil
}
func (s *KeywordService) DeleteKeyword(c context.Context, r *v1.DeleteKeywordRequest) (*emptypb.Empty, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	if x = s.uc.Delete(c, e, r.GetId(), r.GetVersion()); x != nil {
		return nil, x
	}
	return &emptypb.Empty{}, nil
}
func keywordDO(i *v1.Keyword) *biz.Keyword {
	if i == nil {
		return nil
	}
	return &biz.Keyword{ID: i.GetId(), BrandID: i.GetBrandId(), Text: i.GetText(), Region: i.GetRegion(), TagsJSON: i.GetTagsJson(), Priority: i.GetPriority(), RequestedQuestionCount: i.GetRequestedQuestionCount(), DistillationStatus: i.GetDistillationStatus(), Status: i.GetStatus(), Source: i.GetSource(), Version: i.GetVersion()}
}
func keywordDTO(i *biz.Keyword) *v1.Keyword {
	if i == nil {
		return nil
	}
	return &v1.Keyword{Id: i.ID, BrandId: i.BrandID, Text: i.Text, Region: i.Region, TagsJson: i.TagsJSON, Priority: i.Priority, RequestedQuestionCount: i.RequestedQuestionCount, DistilledQuestionCount: i.DistilledQuestionCount, DistillationStatus: i.DistillationStatus, LastDistillationTaskId: i.LastDistillationTaskID, DistillationError: i.DistillationError, Status: i.Status, Source: i.Source, Version: i.Version, CreatedAt: timestamppb.New(i.CreatedAt), UpdatedAt: timestamppb.New(i.UpdatedAt)}
}
func keywordDistillationDTO(i *biz.KeywordDistillationTask) *v1.KeywordDistillationTask {
	if i == nil {
		return nil
	}
	o := &v1.KeywordDistillationTask{Id: i.ID, KeywordId: i.KeywordID, BrandId: i.BrandID, WritingModelId: i.WritingModelID, WritingModelVersion: i.WritingModelVersion, ClientRequestId: i.ClientRequestID, Status: i.Status, Region: i.Region, RequestedCount: i.RequestedCount, OutputJson: i.OutputJSON, InputTokens: i.InputTokens, OutputTokens: i.OutputTokens, CostMicros: i.CostMicros, ErrorCode: i.ErrorCode, ErrorMessage: i.ErrorMessage, AttemptCount: i.AttemptCount, CreatedAt: timestamppb.New(i.CreatedAt), UpdatedAt: timestamppb.New(i.UpdatedAt)}
	if i.StartedAt != nil {
		o.StartedAt = timestamppb.New(*i.StartedAt)
	}
	if i.CompletedAt != nil {
		o.CompletedAt = timestamppb.New(*i.CompletedAt)
	}
	return o
}
