package service

import (
	"context"
	"google.golang.org/protobuf/types/known/timestamppb"
	v1 "kratos-svr/api/admin/v1"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/query"
)

type GeoTaskService struct {
	v1.UnimplementedGeoTaskServiceServer
	uc *biz.AdminGeoTaskUsecase
}

func NewGeoTaskService(uc *biz.AdminGeoTaskUsecase) *GeoTaskService { return &GeoTaskService{uc: uc} }
func (s *GeoTaskService) ListGeoTasks(ctx context.Context, req *v1.ListGeoTasksRequest) (*v1.ListGeoTasksReply, error) {
	page, err := query.ParsePage(req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, biz.ErrGeoTaskInvalid
	}
	items, total, err := s.uc.List(ctx, biz.AdminGeoTaskListOptions{Offset: page.Offset, Limit: page.Limit, EnterpriseID: req.GetEnterpriseId(), InclusionSiteID: req.GetInclusionSiteId(), Status: req.GetStatus(), ErrorCategory: req.GetErrorCategory(), Keyword: req.GetKeyword()})
	if err != nil {
		return nil, err
	}
	out := &v1.ListGeoTasksReply{TotalSize: total}
	for _, v := range items {
		out.Items = append(out.Items, geoTaskDTO(v))
	}
	if page.Offset+len(items) < int(total) {
		out.NextPageToken = query.NextToken(page.Offset + len(items))
	}
	return out, nil
}
func (s *GeoTaskService) GetGeoTask(ctx context.Context, req *v1.GetGeoTaskRequest) (*v1.GeoTaskDetail, error) {
	d, err := s.uc.Get(ctx, req.GetId())
	if err != nil {
		return nil, err
	}
	return geoTaskDetailDTO(d), nil
}
func (s *GeoTaskService) RetryGeoTask(ctx context.Context, req *v1.GeoTaskActionRequest) (*v1.GeoTaskDetail, error) {
	return s.action(ctx, req, "retry")
}
func (s *GeoTaskService) CancelGeoTask(ctx context.Context, req *v1.GeoTaskActionRequest) (*v1.GeoTaskDetail, error) {
	return s.action(ctx, req, "cancel")
}
func (s *GeoTaskService) action(ctx context.Context, req *v1.GeoTaskActionRequest, action string) (*v1.GeoTaskDetail, error) {
	op, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	d, err := s.uc.ChangeStatus(ctx, biz.AdminGeoTaskAction{ID: req.GetId(), Version: req.GetVersion(), OperatorID: op, Action: action, Reason: req.GetReason()})
	if err != nil {
		return nil, err
	}
	return geoTaskDetailDTO(d), nil
}
func (s *GeoTaskService) CreateManualReview(ctx context.Context, req *v1.CreateManualReviewRequest) (*v1.GeoTaskDetail, error) {
	op, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	d, err := s.uc.CreateManualReview(ctx, biz.AdminManualReviewCommand{TaskID: req.GetTaskId(), AnswerSnapshotID: req.GetAnswerSnapshotId(), AnalysisResultID: req.AnalysisResultId, OperatorID: op, BeforeJSON: req.GetBeforeJson(), AfterJSON: req.GetAfterJson(), Reason: req.GetReason()})
	if err != nil {
		return nil, err
	}
	return geoTaskDetailDTO(d), nil
}
func geoTaskDTO(v *biz.AdminGeoTask) *v1.GeoTask {
	if v == nil {
		return nil
	}
	return &v1.GeoTask{Id: v.ID, EnterpriseId: v.EnterpriseID, EnterpriseName: v.EnterpriseName, MonitorPlanId: v.MonitorPlanID, MonitorPlanName: v.MonitorPlanName, BrandId: v.BrandID, BrandName: v.BrandName, QuestionId: v.QuestionID, QuestionText: v.QuestionText, InclusionSiteId: v.InclusionSiteID, InclusionSiteName: v.InclusionSiteName, PlatformAccountId: v.PlatformAccountID, ModelEntry: v.ModelEntry, Locale: v.Locale, Region: v.Region, Status: v.Status, Priority: v.Priority, TerminalType: v.TerminalType, ScheduledAt: timestamppb.New(v.ScheduledAt), AttemptCount: v.AttemptCount, MaxAttempts: v.MaxAttempts, ErrorCategory: v.ErrorCategory, ErrorCode: v.ErrorCode, ErrorMessage: v.ErrorMessage, CompletedAt: timestampProto(v.CompletedAt), Version: v.Version, CreatedAt: timestamppb.New(v.CreatedAt), UpdatedAt: timestamppb.New(v.UpdatedAt), BrandMentioned: v.BrandMentioned, SessionRef: v.SessionRef}
}
func geoTaskDetailDTO(d *biz.AdminGeoTaskDetail) *v1.GeoTaskDetail {
	out := &v1.GeoTaskDetail{Task: geoTaskDTO(d.Task)}
	if v := d.Answer; v != nil {
		out.Answer = &v1.AnswerSnapshot{Id: v.ID, AttemptId: v.AttemptID, ModelEntry: v.ModelEntry, QuestionText: v.QuestionText, AnswerText: v.AnswerText, AnswerStatus: v.AnswerStatus, ScreenshotKey: v.ScreenshotKey, EvidenceJson: v.EvidenceJSON, SessionRef: v.SessionRef, ObservedAt: timestamppb.New(v.ObservedAt), ClientVersion: v.ClientVersion}
	}
	for _, v := range d.Citations {
		out.Citations = append(out.Citations, &v1.Citation{Id: v.ID, Url: v.URL, Domain: v.Domain, Title: v.Title, Position: v.Position, IsEnterpriseSource: v.IsEnterpriseSource, ArticleId: v.ArticleID, MetadataJson: v.MetadataJSON})
	}
	for _, v := range d.Mentions {
		out.Mentions = append(out.Mentions, &v1.Mention{Id: v.ID, EntityType: v.EntityType, EntityId: v.EntityID, Text: v.Text, Position: v.Position, Sentiment: v.Sentiment, Confidence: v.Confidence})
	}
	if v := d.Analysis; v != nil {
		out.Analysis = &v1.AnalysisResult{Id: v.ID, AnalysisVersion: v.AnalysisVersion, RuleVersion: v.RuleVersion, Status: v.Status, BrandMentioned: v.BrandMentioned, EnterpriseCited: v.EnterpriseCited, VisibilityScore: v.VisibilityScore, AccuracyScore: v.AccuracyScore, Confidence: v.Confidence, ResultJson: v.ResultJSON}
	}
	for _, v := range d.Reviews {
		out.Reviews = append(out.Reviews, &v1.ManualReview{Id: v.ID, AnswerSnapshotId: v.AnswerSnapshotID, AnalysisResultId: v.AnalysisResultID, ReviewerId: v.ReviewerID, BeforeJson: v.BeforeJSON, AfterJson: v.AfterJSON, Reason: v.Reason, CreatedAt: timestamppb.New(v.CreatedAt)})
	}
	return out
}
