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

type GeoMonitorService struct {
	v1.UnimplementedGeoMonitorServiceServer
	uc *biz.GeoMonitorUsecase
}

func NewGeoMonitorService(u *biz.GeoMonitorUsecase) *GeoMonitorService {
	return &GeoMonitorService{uc: u}
}
func (s *GeoMonitorService) CreateMonitorPlan(c context.Context, r *v1.CreateMonitorPlanRequest) (*v1.MonitorPlan, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	p := monitorPlanDO(r.GetPlan())
	if p != nil {
		p.EnterpriseID = e
	}
	o, x := s.uc.Create(c, p)
	if x != nil {
		return nil, x
	}
	return monitorPlanDTO(o), nil
}
func (s *GeoMonitorService) GetMonitorPlan(c context.Context, r *v1.GetMonitorPlanRequest) (*v1.MonitorPlan, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	o, x := s.uc.Get(c, e, r.GetId())
	if x != nil {
		return nil, x
	}
	return monitorPlanDTO(o), nil
}
func (s *GeoMonitorService) ListMonitorPlans(c context.Context, r *v1.ListMonitorPlansRequest) (*v1.ListMonitorPlansReply, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	p, x := parseUserPage(r.GetPageSize(), r.GetPageToken())
	if x != nil {
		return nil, biz.ErrMonitorPlanInvalid
	}
	items, total, x := s.uc.List(c, e, biz.MonitorListOptions{Offset: p.Offset, Limit: p.Limit, BrandID: r.GetBrandId(), Status: r.GetStatus()})
	if x != nil {
		return nil, x
	}
	o := &v1.ListMonitorPlansReply{Items: make([]*v1.MonitorPlan, 0, len(items)), TotalSize: total}
	for _, i := range items {
		o.Items = append(o.Items, monitorPlanDTO(i))
	}
	if p.Offset+len(items) < int(total) {
		o.NextPageToken = query.NextToken(p.Offset + len(items))
	}
	return o, nil
}
func (s *GeoMonitorService) ChangeMonitorPlanStatus(c context.Context, r *v1.ChangeMonitorPlanStatusRequest) (*v1.MonitorPlan, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	o, x := s.uc.Change(c, e, r.GetId(), r.GetVersion(), r.GetAction())
	if x != nil {
		return nil, x
	}
	return monitorPlanDTO(o), nil
}
func (s *GeoMonitorService) UpdateMonitorPlan(c context.Context, r *v1.UpdateMonitorPlanRequest) (*v1.MonitorPlan, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	if r.GetId() == 0 {
		return nil, biz.ErrMonitorPlanInvalid
	}
	p := &biz.MonitorPlan{
		ID:           r.GetId(),
		EnterpriseID: e,
		Name:         r.GetName(),
		Version:      r.GetVersion(),
	}
	o, x := s.uc.Update(c, p)
	if x != nil {
		return nil, x
	}
	return monitorPlanDTO(o), nil
}

func (s *GeoMonitorService) DeleteMonitorPlan(c context.Context, r *v1.DeleteMonitorPlanRequest) (*emptypb.Empty, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	if r.GetId() == 0 {
		return nil, biz.ErrMonitorPlanInvalid
	}
	if x := s.uc.Delete(c, e, r.GetId()); x != nil {
		return nil, x
	}
	return &emptypb.Empty{}, nil
}
func (s *GeoMonitorService) ListGeoTasks(c context.Context, r *v1.ListGeoTasksRequest) (*v1.ListGeoTasksReply, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	p, x := parseUserPage(r.GetPageSize(), r.GetPageToken())
	if x != nil {
		return nil, biz.ErrMonitorPlanInvalid
	}
	items, total, x := s.uc.Tasks(c, e, biz.GeoTaskListOptions{Offset: p.Offset, Limit: p.Limit, MonitorPlanID: r.GetMonitorPlanId(), InclusionSiteID: r.GetInclusionSiteId(), Status: r.GetStatus()})
	if x != nil {
		return nil, x
	}
	o := &v1.ListGeoTasksReply{Items: make([]*v1.GeoTask, 0, len(items)), TotalSize: total}
	for _, i := range items {
		o.Items = append(o.Items, geoTaskDTO(i))
	}
	if p.Offset+len(items) < int(total) {
		o.NextPageToken = query.NextToken(p.Offset + len(items))
	}
	return o, nil
}
func (s *GeoMonitorService) GetGeoAnswer(c context.Context, r *v1.GetGeoAnswerRequest) (*v1.GeoAnswer, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	o, x := s.uc.Answer(c, e, r.GetTaskId())
	if x != nil {
		return nil, x
	}
	return geoAnswerDTO(o), nil
}
func (s *GeoMonitorService) GetGeoMetrics(c context.Context, r *v1.GetGeoMetricsRequest) (*v1.GeoMetrics, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	f := biz.MetricsFilter{BrandID: r.GetBrandId(), InclusionSiteID: r.GetInclusionSiteId()}
	if r.GetFrom() != nil {
		f.From = r.GetFrom().AsTime()
	}
	if r.GetTo() != nil {
		f.To = r.GetTo().AsTime()
	}
	o, x := s.uc.Metrics(c, e, f)
	if x != nil {
		return nil, x
	}
	return &v1.GeoMetrics{TotalAnswers: o.TotalAnswers, ValidAnswers: o.ValidAnswers, BrandMentionRate: o.BrandMentionRate, CitationRate: o.CitationRate, QuestionCoverageRate: o.QuestionCoverageRate, AverageVisibilityScore: o.AverageVisibilityScore}, nil
}
func (s *GeoMonitorService) GetGeoDashboard(c context.Context, r *v1.GetGeoDashboardRequest) (*v1.GeoDashboard, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	o, x := s.uc.Dashboard(c, e, biz.DashboardOptions{
		Range:          r.GetRange(),
		PageSize:       int(r.GetPageSize()),
		PageToken:      r.GetPageToken(),
		InclusionSiteID: r.GetInclusionSiteId(),
	})
	if x != nil {
		return nil, x
	}
	return dashboardDTO(o), nil
}
func monitorPlanDO(i *v1.MonitorPlan) *biz.MonitorPlan {
	if i == nil {
		return nil
	}
	o := &biz.MonitorPlan{ID: i.GetId(), Name: i.GetName(), BrandID: i.GetBrandId(), Status: i.GetStatus(), ScheduleType: i.GetScheduleType(), MonitorTerminal: i.GetMonitorTerminal(), CronExpression: i.GetCronExpression(), Timezone: i.GetTimezone(), QuestionIDsJSON: i.GetQuestionIdsJson(), SiteTargetsJSON: i.GetSiteTargetsJson(), ClientRequestID: i.GetClientRequestId(), Version: i.GetVersion()}
	if i.GetNextRunAt() != nil {
		t := i.GetNextRunAt().AsTime()
		o.NextRunAt = &t
	}
	if i.GetLastRunAt() != nil {
		t := i.GetLastRunAt().AsTime()
		o.LastRunAt = &t
	}
	return o
}
func monitorPlanDTO(i *biz.MonitorPlan) *v1.MonitorPlan {
	if i == nil {
		return nil
	}
	o := &v1.MonitorPlan{Id: i.ID, Name: i.Name, BrandId: i.BrandID, Status: i.Status, ScheduleType: i.ScheduleType, MonitorTerminal: i.MonitorTerminal, CronExpression: i.CronExpression, Timezone: i.Timezone, QuestionIdsJson: i.QuestionIDsJSON, SiteTargetsJson: i.SiteTargetsJSON, ClientRequestId: i.ClientRequestID, Version: i.Version, CreatedAt: timestamppb.New(i.CreatedAt)}
	if i.NextRunAt != nil {
		o.NextRunAt = timestamppb.New(*i.NextRunAt)
	}
	if i.LastRunAt != nil {
		o.LastRunAt = timestamppb.New(*i.LastRunAt)
	}
	return o
}
func geoTaskDTO(i *biz.GeoTask) *v1.GeoTask {
	if i == nil {
		return nil
	}
	o := &v1.GeoTask{Id: i.ID, MonitorPlanId: i.MonitorPlanID, BrandId: i.BrandID, QuestionId: i.QuestionID, InclusionSiteId: i.InclusionSiteID, PlatformAccountId: i.PlatformAccountID, ModelEntry: i.ModelEntry, Locale: i.Locale, Region: i.Region, Status: i.Status, Priority: i.Priority, TerminalType: i.TerminalType, ScheduledAt: timestamppb.New(i.ScheduledAt), ErrorCategory: i.ErrorCategory, ErrorCode: i.ErrorCode, ErrorMessage: i.ErrorMessage, SessionRef: i.SessionRef, BrandMentioned: i.BrandMentioned}
	if i.CompletedAt != nil {
		o.CompletedAt = timestamppb.New(*i.CompletedAt)
	}
	return o
}
func geoAnswerDTO(i *biz.GeoAnswer) *v1.GeoAnswer {
	if i == nil {
		return nil
	}
	o := &v1.GeoAnswer{SnapshotId: i.SnapshotID, TaskId: i.TaskID, QuestionText: i.QuestionText, AnswerText: i.AnswerText, AnswerStatus: i.AnswerStatus, ScreenshotKey: i.ScreenshotKey, EvidenceJson: i.EvidenceJSON, ObservedAt: timestamppb.New(i.ObservedAt), VisibilityScore: i.VisibilityScore, AccuracyScore: i.AccuracyScore, Confidence: i.Confidence, SessionRef: i.SessionRef}
	for _, c := range i.Citations {
		o.Citations = append(o.Citations, &v1.GeoCitation{Url: c.URL, Domain: c.Domain, Title: c.Title, Position: c.Position, EnterpriseSource: c.EnterpriseSource, ArticleId: c.ArticleID})
	}
	for _, m := range i.Mentions {
		o.Mentions = append(o.Mentions, &v1.GeoMention{EntityType: m.EntityType, EntityId: m.EntityID, Text: m.Text, Position: m.Position, Sentiment: m.Sentiment, Confidence: m.Confidence})
	}
	return o
}
func dashboardDTO(i *biz.GeoDashboard) *v1.GeoDashboard {
	if i == nil {
		return nil
	}
	o := &v1.GeoDashboard{
		Company:       dashboardCompanyDTO(&i.Company),
		Overview:      dashboardOverviewDTO(&i.Overview),
		NextPageToken: i.NextPageToken,
		TotalSize:     i.TotalSize,
		UpdatedAt:     timestamppb.New(i.UpdatedAt),
	}
	for _, p := range i.Trend {
		o.Trend = append(o.Trend, &v1.DashboardTrendPoint{Date: p.Date, Included: p.Included})
	}
	for _, s := range i.SiteStats {
		o.SiteStats = append(o.SiteStats, &v1.DashboardSiteStat{InclusionSiteId: s.InclusionSiteID, SiteName: s.SiteName, Included: s.Included})
	}
	for _, k := range i.TopKeywords {
		o.TopKeywords = append(o.TopKeywords, &v1.DashboardTopKeyword{KeywordId: k.KeywordID, Keyword: k.Keyword, IncludedCount: k.IncludedCount})
	}
	for _, t := range i.Tasks {
		o.Tasks = append(o.Tasks, geoTaskDTO(t))
	}
	return o
}
func dashboardCompanyDTO(i *biz.DashboardCompanyCard) *v1.DashboardCompanyCard {
	if i == nil {
		return nil
	}
	o := &v1.DashboardCompanyCard{
		EnterpriseName:  i.EnterpriseName,
		Contact:         i.Contact,
		Website:         i.Website,
		AiTrainingCount: i.AITrainingCount,
		BrandName:       i.BrandName,
		BrandNames:      i.BrandNames,
		Keywords:        i.Keywords,
		KeywordCount:    i.KeywordCount,
		QuestionCount:   i.QuestionCount,
	}
	if i.OnlineAt != nil {
		o.OnlineAt = timestamppb.New(*i.OnlineAt)
	}
	if i.ExpireAt != nil {
		o.ExpireAt = timestamppb.New(*i.ExpireAt)
	}
	return o
}
func dashboardOverviewDTO(i *biz.DashboardOverview) *v1.DashboardOverview {
	if i == nil {
		return nil
	}
	return &v1.DashboardOverview{
		TotalIncluded:     i.TotalIncluded,
		RecentIncluded:    i.RecentIncluded,
		PublishedArticles: i.PublishedArticles,
		ContactExposure:   i.ContactExposure,
	}
}
