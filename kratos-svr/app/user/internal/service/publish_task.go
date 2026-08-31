package service

import (
	"context"

	"google.golang.org/protobuf/types/known/timestamppb"

	v1 "kratos-svr/api/user/v1"
	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/authn"
	"kratos-svr/internal/query"
)

type PublishTaskService struct {
	v1.UnimplementedPublishTaskServiceServer
	uc *biz.PublishTaskUsecase
}

func NewPublishTaskService(u *biz.PublishTaskUsecase) *PublishTaskService {
	return &PublishTaskService{uc: u}
}
func (s *PublishTaskService) CreatePublishPlan(c context.Context, r *v1.CreatePublishPlanRequest) (*v1.PublishPlan, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	p := &biz.PublishPlan{EnterpriseID: e, Name: r.GetName(), ScheduleType: r.GetScheduleType(), Timezone: r.GetTimezone(), FailurePolicyJSON: r.GetFailurePolicyJson(), ClientRequestID: r.GetClientRequestId(), DedupStrategy: r.GetDedupStrategy()}
	if r.GetScheduledAt() != nil {
		t := r.GetScheduledAt().AsTime()
		p.ScheduledAt = &t
	}
	// 优先使用新的多文章字段；兼容已弃用的单文章字段
	articleIDs := r.GetArticleIds()
	snapshotIDs := r.GetArticleSnapshotIds()
	if len(articleIDs) == 0 && r.GetArticleId() != 0 {
		articleIDs = []uint64{r.GetArticleId()}
		snapshotIDs = []uint64{r.GetArticleSnapshotId()}
	}
	articles := make([]biz.ArticleInput, 0, len(articleIDs))
	for i, aid := range articleIDs {
		var sid uint64
		if i < len(snapshotIDs) {
			sid = snapshotIDs[i]
		}
		articles = append(articles, biz.ArticleInput{ArticleID: aid, ArticleSnapshotID: sid})
	}
	targets := make([]biz.PublishTargetInput, 0, len(r.GetTargets()))
	for _, i := range r.GetTargets() {
		targets = append(targets, biz.PublishTargetInput{PublishChannelID: i.GetPublishChannelId(), PublishTargetID: i.GetPublishTargetId(), PlatformAccountID: i.GetPlatformAccountId(), ExecutionMode: i.GetExecutionMode(), Priority: i.GetPriority()})
	}
	o, x := s.uc.Create(c, p, articles, targets)
	if x != nil {
		return nil, x
	}
	return publishPlanDTO(o), nil
}
func (s *PublishTaskService) GetPublishPlan(c context.Context, r *v1.GetPublishPlanRequest) (*v1.PublishPlanDetail, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	p, t, x := s.uc.Get(c, e, r.GetId())
	if x != nil {
		return nil, x
	}
	o := &v1.PublishPlanDetail{Plan: publishPlanDTO(p), Tasks: make([]*v1.PublishTask, 0, len(t))}
	for _, i := range t {
		o.Tasks = append(o.Tasks, publishTaskDTO(i))
	}
	return o, nil
}
func (s *PublishTaskService) ListPublishPlans(c context.Context, r *v1.ListPublishPlansRequest) (*v1.ListPublishPlansReply, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	p, x := parseUserPage(r.GetPageSize(), r.GetPageToken())
	if x != nil {
		return nil, biz.ErrPublishPlanInvalid
	}
	items, total, x := s.uc.List(c, e, biz.PublishPlanListOptions{Offset: p.Offset, Limit: p.Limit, Status: r.GetStatus(), ArticleID: r.GetArticleId()})
	if x != nil {
		return nil, x
	}
	o := &v1.ListPublishPlansReply{Items: make([]*v1.PublishPlan, 0, len(items)), TotalSize: total}
	for _, i := range items {
		o.Items = append(o.Items, publishPlanDTO(i))
	}
	if p.Offset+len(items) < int(total) {
		o.NextPageToken = query.NextToken(p.Offset + len(items))
	}
	return o, nil
}

func (s *PublishTaskService) ChangePublishPlanStatus(c context.Context, r *v1.ChangePublishPlanStatusRequest) (*v1.PublishPlan, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	o, x := s.uc.Change(c, e, r.GetId(), r.GetVersion(), r.GetAction())
	if x != nil {
		return nil, x
	}
	return publishPlanDTO(o), nil
}
func (s *PublishTaskService) RetryPublishTask(c context.Context, r *v1.RetryPublishTaskRequest) (*v1.PublishTask, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	o, x := s.uc.Retry(c, e, r.GetTaskId(), r.GetVersion())
	if x != nil {
		return nil, x
	}
	return publishTaskDTO(o), nil
}

func (s *PublishTaskService) ListSucceededPublishTasks(c context.Context, r *v1.ListSucceededPublishTasksRequest) (*v1.ListSucceededPublishTasksReply, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	p, x := parseUserPage(r.GetPageSize(), r.GetPageToken())
	if x != nil {
		return nil, biz.ErrPublishPlanInvalid
	}
	items, total, x := s.uc.ListSucceeded(c, e, biz.PublishTaskListOptions{Offset: p.Offset, Limit: p.Limit})
	if x != nil {
		return nil, x
	}
	o := &v1.ListSucceededPublishTasksReply{Items: make([]*v1.PublishTask, 0, len(items)), TotalSize: total}
	for _, i := range items {
		o.Items = append(o.Items, publishTaskDTO(i))
	}
	if p.Offset+len(items) < int(total) {
		o.NextPageToken = query.NextToken(p.Offset + len(items))
	}
	return o, nil
}

func publishPlanDTO(i *biz.PublishPlan) *v1.PublishPlan {
	if i == nil {
		return nil
	}
	o := &v1.PublishPlan{Id: i.ID, Name: i.Name, ArticleTitle: i.ArticleTitle, Status: i.Status, ScheduleType: i.ScheduleType, Timezone: i.Timezone, FailurePolicyJson: i.FailurePolicyJSON, DedupStrategy: i.DedupStrategy, ClientRequestId: i.ClientRequestID, Version: i.Version, CreatedAt: timestamppb.New(i.CreatedAt), ArticleCount: i.ArticleCount, PlatformCount: i.PlatformCount, TaskCount: i.TaskCount, SucceededCount: i.SucceededCount, FailedCount: i.FailedCount}
	// ArticleID/ArticleSnapshotID 现在为可选（新计划置空）；保留兼容旧客户端
	if i.ArticleID != nil {
		o.ArticleId = *i.ArticleID
	}
	if i.ArticleSnapshotID != nil {
		o.ArticleSnapshotId = *i.ArticleSnapshotID
	}
	if i.ScheduledAt != nil {
		o.ScheduledAt = timestamppb.New(*i.ScheduledAt)
	}
	return o
}
func publishTaskDTO(i *biz.PublishTask) *v1.PublishTask {
	if i == nil {
		return nil
	}
	o := &v1.PublishTask{Id: i.ID, PublishPlanId: i.PublishPlanID, ArticleId: i.ArticleID, PublishChannelId: i.PublishChannelID, PublishTargetId: i.PublishTargetID, PlatformAccountId: i.PlatformAccountID, ExecutionMode: i.ExecutionMode, Status: i.Status, Priority: i.Priority, ScheduledAt: timestamppb.New(i.ScheduledAt), AttemptCount: i.AttemptCount, MaxAttempts: i.MaxAttempts, ResultUrl: i.ResultURL, PlatformArticleId: i.PlatformArticleID, ErrorCategory: i.ErrorCategory, ErrorCode: i.ErrorCode, ErrorMessage: i.ErrorMessage, Version: i.Version, ResultJson: i.ResultJSON, EvidenceJson: i.EvidenceJSON}
	if i.CompletedAt != nil {
		o.CompletedAt = timestamppb.New(*i.CompletedAt)
	}
	return o
}
