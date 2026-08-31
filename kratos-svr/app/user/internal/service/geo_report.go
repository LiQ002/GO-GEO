package service

import (
	"context"

	v1 "kratos-svr/api/user/v1"
	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/authn"

	"google.golang.org/protobuf/types/known/timestamppb"
)

type GeoReportService struct {
	v1.UnimplementedGeoReportServiceServer
	usecase *biz.GeoMonitorUsecase
}

func NewGeoReportService(usecase *biz.GeoMonitorUsecase) *GeoReportService {
	return &GeoReportService{usecase: usecase}
}

func (s *GeoReportService) GetGeoReportSummary(ctx context.Context, req *v1.GetGeoReportSummaryRequest) (*v1.GeoReportSummary, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return nil, err
	}
	metrics, filter, err := s.usecase.ReportMetrics(ctx, enterpriseID, geoReportFilterDO(req.GetFilter()))
	if err != nil {
		return nil, err
	}
	return &v1.GeoReportSummary{Filter: geoReportFilterDTO(filter), Metrics: geoReportMetricsDTO(metrics), GeneratedAt: timestamppb.Now()}, nil
}

func (s *GeoReportService) ListGeoReportTrend(ctx context.Context, req *v1.ListGeoReportTrendRequest) (*v1.ListGeoReportTrendReply, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return nil, err
	}
	items, filter, err := s.usecase.ReportTrend(ctx, enterpriseID, geoReportFilterDO(req.GetFilter()))
	if err != nil {
		return nil, err
	}
	reply := &v1.ListGeoReportTrendReply{Filter: geoReportFilterDTO(filter), Items: make([]*v1.GeoReportTrendPoint, 0, len(items)), GeneratedAt: timestamppb.Now()}
	for _, item := range items {
		reply.Items = append(reply.Items, &v1.GeoReportTrendPoint{Date: item.Date, Metrics: geoReportMetricsDTO(&item.Metrics)})
	}
	return reply, nil
}

func (s *GeoReportService) ListGeoSitePerformance(ctx context.Context, req *v1.ListGeoSitePerformanceRequest) (*v1.ListGeoSitePerformanceReply, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return nil, err
	}
	items, filter, err := s.usecase.ReportSitePerformance(ctx, enterpriseID, geoReportFilterDO(req.GetFilter()))
	if err != nil {
		return nil, err
	}
	reply := &v1.ListGeoSitePerformanceReply{Filter: geoReportFilterDTO(filter), Items: make([]*v1.GeoSitePerformance, 0, len(items)), GeneratedAt: timestamppb.Now()}
	for _, item := range items {
		reply.Items = append(reply.Items, &v1.GeoSitePerformance{InclusionSiteId: item.InclusionSiteID, InclusionSiteName: item.InclusionSiteName, Metrics: geoReportMetricsDTO(&item.Metrics)})
	}
	return reply, nil
}

func geoReportFilterDO(filter *v1.GeoReportFilter) biz.MetricsFilter {
	var result biz.MetricsFilter
	if filter == nil {
		return result
	}
	result.BrandID = filter.GetBrandId()
	result.InclusionSiteID = filter.GetInclusionSiteId()
	if filter.GetFrom() != nil {
		result.From = filter.GetFrom().AsTime()
	}
	if filter.GetTo() != nil {
		result.To = filter.GetTo().AsTime()
	}
	return result
}

func geoReportFilterDTO(filter biz.MetricsFilter) *v1.GeoReportFilter {
	result := &v1.GeoReportFilter{BrandId: filter.BrandID, InclusionSiteId: filter.InclusionSiteID}
	if !filter.From.IsZero() {
		result.From = timestamppb.New(filter.From)
	}
	if !filter.To.IsZero() {
		result.To = timestamppb.New(filter.To)
	}
	return result
}

func geoReportMetricsDTO(metrics *biz.GeoMetrics) *v1.GeoReportMetrics {
	if metrics == nil {
		return nil
	}
	return &v1.GeoReportMetrics{
		TotalAnswers: metrics.TotalAnswers, ValidAnswers: metrics.ValidAnswers,
		BrandMentionRate: metrics.BrandMentionRate, CitationRate: metrics.CitationRate,
		QuestionCoverageRate: metrics.QuestionCoverageRate, AverageVisibilityScore: metrics.AverageVisibilityScore,
	}
}
