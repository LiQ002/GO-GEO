package service

import (
	"context"
	"google.golang.org/protobuf/types/known/timestamppb"
	v1 "kratos-svr/api/admin/v1"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/query"
)

type PublishTaskService struct {
	v1.UnimplementedPublishTaskServiceServer
	uc *biz.AdminPublishTaskUsecase
}

func NewPublishTaskService(uc *biz.AdminPublishTaskUsecase) *PublishTaskService {
	return &PublishTaskService{uc: uc}
}
func (s *PublishTaskService) ListPublishTasks(ctx context.Context, req *v1.ListPublishTasksRequest) (*v1.ListPublishTasksReply, error) {
	page, err := query.ParsePage(req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, biz.ErrPublishTaskInvalid
	}
	items, total, err := s.uc.List(ctx, biz.AdminPublishTaskListOptions{Offset: page.Offset, Limit: page.Limit, EnterpriseID: req.GetEnterpriseId(), PublishChannelID: req.GetPublishChannelId(), Status: req.GetStatus(), ErrorCategory: req.GetErrorCategory(), Keyword: req.GetKeyword()})
	if err != nil {
		return nil, err
	}
	out := &v1.ListPublishTasksReply{TotalSize: total}
	for _, v := range items {
		out.Items = append(out.Items, publishTaskDTO(v))
	}
	if page.Offset+len(items) < int(total) {
		out.NextPageToken = query.NextToken(page.Offset + len(items))
	}
	return out, nil
}
func (s *PublishTaskService) GetPublishTask(ctx context.Context, req *v1.GetPublishTaskRequest) (*v1.PublishTaskDetail, error) {
	d, err := s.uc.Get(ctx, req.GetId())
	if err != nil {
		return nil, err
	}
	return publishTaskDetailDTO(d), nil
}
func (s *PublishTaskService) RetryPublishTask(ctx context.Context, req *v1.PublishTaskActionRequest) (*v1.PublishTaskDetail, error) {
	return s.action(ctx, req, "retry")
}
func (s *PublishTaskService) CancelPublishTask(ctx context.Context, req *v1.PublishTaskActionRequest) (*v1.PublishTaskDetail, error) {
	return s.action(ctx, req, "cancel")
}
func (s *PublishTaskService) action(ctx context.Context, req *v1.PublishTaskActionRequest, action string) (*v1.PublishTaskDetail, error) {
	op, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	d, err := s.uc.ChangeStatus(ctx, biz.AdminPublishTaskAction{ID: req.GetId(), Version: req.GetVersion(), OperatorID: op, Action: action, Reason: req.GetReason()})
	if err != nil {
		return nil, err
	}
	return publishTaskDetailDTO(d), nil
}
func (s *PublishTaskService) SaveSubmissionReceipt(ctx context.Context, req *v1.SaveSubmissionReceiptRequest) (*v1.PublishTaskDetail, error) {
	op, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	r := req.GetReceipt()
	var item *biz.AdminSubmissionReceipt
	if r != nil {
		item = &biz.AdminSubmissionReceipt{ID: r.GetId(), ReceiptType: r.GetReceiptType(), ReceiptCode: r.GetReceiptCode(), Status: r.GetStatus(), SubmittedAt: timestampPointer(r.GetSubmittedAt()), ExpectedAt: timestampPointer(r.GetExpectedAt()), PublishedAt: timestampPointer(r.GetPublishedAt()), PublishedURL: r.GetPublishedUrl(), CostMinorUnits: r.GetCostMinorUnits(), Currency: r.GetCurrency(), FollowUpJSON: r.GetFollowUpJson()}
	}
	d, err := s.uc.SaveReceipt(ctx, biz.AdminReceiptCommand{TaskID: req.GetTaskId(), OperatorID: op, Receipt: item, Reason: req.GetReason()})
	if err != nil {
		return nil, err
	}
	return publishTaskDetailDTO(d), nil
}
func publishTaskDTO(v *biz.AdminPublishTask) *v1.PublishTask {
	if v == nil {
		return nil
	}
	return &v1.PublishTask{Id: v.ID, EnterpriseId: v.EnterpriseID, EnterpriseName: v.EnterpriseName, PublishPlanId: v.PublishPlanID, PublishPlanName: v.PublishPlanName, ArticleSnapshotId: v.ArticleSnapshotID, ArticleTitle: v.ArticleTitle, PublishChannelId: v.PublishChannelID, PublishChannelName: v.PublishChannelName, PublishTargetId: v.PublishTargetID, PublishTargetName: v.PublishTargetName, PlatformAccountId: v.PlatformAccountID, ExecutionMode: v.ExecutionMode, Status: v.Status, Priority: v.Priority, ScheduledAt: timestamppb.New(v.ScheduledAt), NextRetryAt: timestampProto(v.NextRetryAt), AttemptCount: v.AttemptCount, MaxAttempts: v.MaxAttempts, ResultUrl: v.ResultURL, PlatformArticleId: v.PlatformArticleID, ErrorCategory: v.ErrorCategory, ErrorCode: v.ErrorCode, ErrorMessage: v.ErrorMessage, CompletedAt: timestampProto(v.CompletedAt), Version: v.Version, CreatedAt: timestamppb.New(v.CreatedAt), UpdatedAt: timestamppb.New(v.UpdatedAt)}
}
func receiptDTO(v *biz.AdminSubmissionReceipt) *v1.SubmissionReceipt {
	if v == nil {
		return nil
	}
	return &v1.SubmissionReceipt{Id: v.ID, ReceiptType: v.ReceiptType, ReceiptCode: v.ReceiptCode, Status: v.Status, SubmittedAt: timestampProto(v.SubmittedAt), ExpectedAt: timestampProto(v.ExpectedAt), PublishedAt: timestampProto(v.PublishedAt), PublishedUrl: v.PublishedURL, CostMinorUnits: v.CostMinorUnits, Currency: v.Currency, FollowUpJson: v.FollowUpJSON}
}
func publishTaskDetailDTO(d *biz.AdminPublishTaskDetail) *v1.PublishTaskDetail {
	out := &v1.PublishTaskDetail{Task: publishTaskDTO(d.Task), Receipt: receiptDTO(d.Receipt)}
	for _, v := range d.Attempts {
		out.Attempts = append(out.Attempts, &v1.PublishAttempt{Id: v.ID, AttemptNumber: v.AttemptNumber, WorkerNodeId: v.WorkerNodeID, LeaseId: v.LeaseID, Status: v.Status, StartedAt: timestamppb.New(v.StartedAt), FinishedAt: timestampProto(v.FinishedAt), DurationMs: v.DurationMS, ResultJson: v.ResultJSON, EvidenceJson: v.EvidenceJSON, ErrorCategory: v.ErrorCategory, ErrorCode: v.ErrorCode, ErrorMessage: v.ErrorMessage, ClientVersion: v.ClientVersion})
	}
	return out
}
