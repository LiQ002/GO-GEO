package service

import (
	"context"
	"google.golang.org/protobuf/types/known/timestamppb"
	v1 "kratos-svr/api/admin/v1"
	"kratos-svr/app/admin/internal/biz"
)

type DashboardService struct {
	v1.UnimplementedDashboardServiceServer
	uc *biz.DashboardUsecase
}

func NewDashboardService(uc *biz.DashboardUsecase) *DashboardService {
	return &DashboardService{uc: uc}
}
func (s *DashboardService) GetDashboard(ctx context.Context, req *v1.GetDashboardRequest) (*v1.Dashboard, error) {
	d, err := s.uc.Get(ctx, int(req.GetTrendDays()))
	if err != nil {
		return nil, err
	}
	out := &v1.Dashboard{GeneratedAt: timestamppb.New(d.GeneratedAt)}
	for _, v := range d.Metrics {
		out.Metrics = append(out.Metrics, &v1.DashboardMetric{Key: v.Key, Label: v.Label, Value: v.Value, ComparisonValue: v.ComparisonValue})
	}
	for _, v := range d.Trends {
		out.Trends = append(out.Trends, &v1.DashboardTrend{Date: v.Date, Articles: v.Articles, PublishSucceeded: v.PublishSucceeded, GeoSucceeded: v.GeoSucceeded, FailedTasks: v.FailedTasks})
	}
	for _, v := range d.Alerts {
		out.Alerts = append(out.Alerts, &v1.DashboardAlert{Id: v.ID, Severity: v.Severity, Title: v.Title, ResourceType: v.ResourceType, ResourceId: v.ResourceID, CreatedAt: timestamppb.New(v.CreatedAt)})
	}
	for _, v := range d.PlatformStats {
		out.PlatformStats = append(out.PlatformStats, &v1.DashboardPlatformStat{Platform: v.Platform, Label: v.Label, Count: v.Count, SuccessRate: v.SuccessRate})
	}
	for _, v := range d.Activities {
		out.Activities = append(out.Activities, &v1.DashboardActivity{Id: v.ID, Type: v.Type, Message: v.Message, CreatedAt: timestamppb.New(v.CreatedAt)})
	}
	return out, nil
}
