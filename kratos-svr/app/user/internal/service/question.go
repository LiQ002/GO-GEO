package service

import (
	"context"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
	v1 "kratos-svr/api/user/v1"
	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/authn"
	"kratos-svr/internal/query"
)

type QuestionService struct {
	v1.UnimplementedQuestionServiceServer
	uc *biz.QuestionUsecase
}

func NewQuestionService(u *biz.QuestionUsecase) *QuestionService { return &QuestionService{uc: u} }
func (s *QuestionService) CreateQuestion(c context.Context, r *v1.CreateQuestionRequest) (*v1.Question, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	i := questionDO(r.GetQuestion())
	if i != nil {
		i.EnterpriseID = e
	}
	o, x := s.uc.Create(c, i)
	if x != nil {
		return nil, x
	}
	return questionDTO(o), nil
}
func (s *QuestionService) GetQuestion(c context.Context, r *v1.GetQuestionRequest) (*v1.Question, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	o, x := s.uc.Get(c, e, r.GetId())
	if x != nil {
		return nil, x
	}
	return questionDTO(o), nil
}
func (s *QuestionService) ListQuestions(c context.Context, r *v1.ListQuestionsRequest) (*v1.ListQuestionsReply, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	p, x := parseUserPage(r.GetPageSize(), r.GetPageToken())
	if x != nil {
		return nil, biz.ErrQuestionInvalid
	}
	items, total, x := s.uc.List(c, e, biz.QuestionListOptions{Offset: p.Offset, Limit: p.Limit, BrandID: r.GetBrandId(), KeywordID: r.GetKeywordId(), Status: r.GetStatus(), Keyword: r.GetKeyword()})
	if x != nil {
		return nil, x
	}
	o := &v1.ListQuestionsReply{Items: make([]*v1.Question, 0, len(items)), TotalSize: total}
	for _, i := range items {
		o.Items = append(o.Items, questionDTO(i))
	}
	if p.Offset+len(items) < int(total) {
		o.NextPageToken = query.NextToken(p.Offset + len(items))
	}
	return o, nil
}
func (s *QuestionService) UpdateQuestion(c context.Context, r *v1.UpdateQuestionRequest) (*v1.Question, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	i := questionDO(r.GetQuestion())
	if i != nil {
		i.EnterpriseID = e
	}
	o, x := s.uc.Update(c, i)
	if x != nil {
		return nil, x
	}
	return questionDTO(o), nil
}
func (s *QuestionService) DeleteQuestion(c context.Context, r *v1.DeleteQuestionRequest) (*emptypb.Empty, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	if x = s.uc.Delete(c, e, r.GetId(), r.GetVersion()); x != nil {
		return nil, x
	}
	return &emptypb.Empty{}, nil
}
func (s *QuestionService) ReviewQuestion(c context.Context, r *v1.ReviewQuestionRequest) (*v1.Question, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	o, x := s.uc.Review(c, e, r.GetId(), r.GetVersion(), r.GetAction(), r.GetReason())
	if x != nil {
		return nil, x
	}
	return questionDTO(o), nil
}
func questionDO(i *v1.Question) *biz.Question {
	if i == nil {
		return nil
	}
	return &biz.Question{ID: i.GetId(), KeywordID: i.GetKeywordId(), BrandID: i.GetBrandId(), DistillationTaskID: i.GetDistillationTaskId(), Text: i.GetText(), Region: i.GetRegion(), Source: i.GetSource(), Status: i.GetStatus(), Intent: i.GetIntent(), Audience: i.GetAudience(), FunnelStage: i.GetFunnelStage(), ClusterCode: i.GetClusterCode(), Priority: i.GetPriority(), SortOrder: i.GetSortOrder(), Version: i.GetVersion()}
}
func questionDTO(i *biz.Question) *v1.Question {
	if i == nil {
		return nil
	}
	return &v1.Question{Id: i.ID, KeywordId: i.KeywordID, BrandId: i.BrandID, DistillationTaskId: i.DistillationTaskID, Text: i.Text, Region: i.Region, Source: i.Source, Status: i.Status, Intent: i.Intent, Audience: i.Audience, FunnelStage: i.FunnelStage, ClusterCode: i.ClusterCode, Priority: i.Priority, SortOrder: i.SortOrder, Version: i.Version, CreatedAt: timestamppb.New(i.CreatedAt), UpdatedAt: timestamppb.New(i.UpdatedAt)}
}
