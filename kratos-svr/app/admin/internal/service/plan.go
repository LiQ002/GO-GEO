package service

import (
	"context"
	"fmt"
	"log/slog"

	v1 "kratos-svr/api/admin/v1"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/query"

	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type PlanService struct {
	v1.UnimplementedPlanServiceServer
	uc *biz.PlanUsecase
}

func NewPlanService(uc *biz.PlanUsecase) *PlanService { return &PlanService{uc: uc} }

func (s *PlanService) CreatePlan(ctx context.Context, req *v1.CreatePlanRequest) (*v1.Plan, error) {
	item, err := s.uc.Create(ctx, planDO(req.GetPlan()))
	if err != nil {
		return nil, err
	}
	return planDTO(item), nil
}

func (s *PlanService) GetPlan(ctx context.Context, req *v1.GetPlanRequest) (*v1.Plan, error) {
	item, err := s.uc.Get(ctx, req.GetId())
	if err != nil {
		return nil, err
	}
	return planDTO(item), nil
}

func (s *PlanService) ListPlans(ctx context.Context, req *v1.ListPlansRequest) (*v1.ListPlansReply, error) {
	page, err := query.ParsePage(req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, biz.ErrPlanInvalid
	}
	items, total, err := s.uc.List(ctx, biz.PlanListOptions{Offset: page.Offset, Limit: page.Limit, Status: req.GetStatus(), Keyword: req.GetKeyword()})
	if err != nil {
		return nil, err
	}
	reply := &v1.ListPlansReply{Items: make([]*v1.Plan, 0, len(items)), TotalSize: total}
	for _, item := range items {
		reply.Items = append(reply.Items, planDTO(item))
	}
	if page.Offset+len(items) < int(total) {
		reply.NextPageToken = query.NextToken(page.Offset + len(items))
	}
	return reply, nil
}

func (s *PlanService) UpdatePlan(ctx context.Context, req *v1.UpdatePlanRequest) (*v1.Plan, error) {
	plan := planDO(req.GetPlan())
	// 临时调试日志：验证 UpdatePlan 收到的 features
	featureSummary := make([]string, 0, len(plan.Features))
	for _, f := range plan.Features {
		featureSummary = append(featureSummary, fmt.Sprintf("feature=%d,enabled=%v", f.Feature, f.Enabled))
	}
	slog.Info("UpdatePlan: 收到 features", "plan_id", plan.ID, "features", featureSummary)
	item, err := s.uc.Update(ctx, plan)
	if err != nil {
		return nil, err
	}
	return planDTO(item), nil
}

func (s *PlanService) DeletePlan(ctx context.Context, req *v1.DeletePlanRequest) (*emptypb.Empty, error) {
	if err := s.uc.Delete(ctx, req.GetId()); err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}

func planDO(item *v1.Plan) *biz.Plan {
	if item == nil {
		return nil
	}
	plan := &biz.Plan{
		ID: item.GetId(), Code: item.GetCode(), Name: item.GetName(), Status: item.GetStatus(),
		Description:               item.GetDescription(),
		HalfYearlyPriceMinorUnits: item.GetHalfYearlyPriceMinorUnits(),
		YearlyPriceMinorUnits:     item.GetYearlyPriceMinorUnits(),
		Currency:               item.GetCurrency(), BillingCycle: item.GetBillingCycle(),
		VisibleToEnterprise:    item.GetVisibleToEnterprise(),
		SortOrder:              item.GetSortOrder(), SeriesCode: item.GetSeriesCode(),
		GrantedPoints:          item.GetGrantedPoints(),
		Limits:                 make([]*biz.PlanLimit, 0, len(item.GetLimits())),
		Features:               make([]*biz.PlanFeature, 0, len(item.GetFeatures())),
	}
	for _, limit := range item.GetLimits() {
		plan.Limits = append(plan.Limits, planLimitDO(limit))
	}
	for _, feature := range item.GetFeatures() {
		plan.Features = append(plan.Features, planFeatureDO(feature))
	}
	return plan
}

func planDTO(item *biz.Plan) *v1.Plan {
	reply := &v1.Plan{
		Id: item.ID, Code: item.Code, Name: item.Name, Status: item.Status,
		Description:               item.Description,
		HalfYearlyPriceMinorUnits: item.HalfYearlyPriceMinorUnits,
		YearlyPriceMinorUnits:     item.YearlyPriceMinorUnits,
		Currency:               item.Currency, BillingCycle: item.BillingCycle,
		VisibleToEnterprise:    item.VisibleToEnterprise,
		SortOrder:              item.SortOrder, SeriesCode: item.SeriesCode,
		GrantedPoints:          item.GrantedPoints,
		Limits:                 make([]*v1.PlanLimit, 0, len(item.Limits)),
		Features:               make([]*v1.PlanFeature, 0, len(item.Features)),
		CreatedAt:              timestamppb.New(item.CreatedAt), UpdatedAt: timestamppb.New(item.UpdatedAt),
	}
	for _, limit := range item.Limits {
		reply.Limits = append(reply.Limits, planLimitDTO(limit))
	}
	for _, feature := range item.Features {
		reply.Features = append(reply.Features, planFeatureDTO(feature))
	}
	return reply
}

func planLimitDO(item *v1.PlanLimit) *biz.PlanLimit {
	if item == nil {
		return nil
	}
	return &biz.PlanLimit{
		ID: item.GetId(), PlanID: item.GetPlanId(), Metric: item.GetMetric(),
		LimitValue: item.GetLimitValue(), Period: item.GetPeriod(),
	}
}

func planLimitDTO(item *biz.PlanLimit) *v1.PlanLimit {
	if item == nil {
		return nil
	}
	return &v1.PlanLimit{
		Id: item.ID, PlanId: item.PlanID, Metric: item.Metric,
		LimitValue: item.LimitValue, Period: item.Period,
	}
}

func planFeatureDO(item *v1.PlanFeature) *biz.PlanFeature {
	if item == nil {
		return nil
	}
	return &biz.PlanFeature{
		ID: item.GetId(), PlanID: item.GetPlanId(), Feature: item.GetFeature(), Enabled: item.GetEnabled(),
	}
}

func planFeatureDTO(item *biz.PlanFeature) *v1.PlanFeature {
	if item == nil {
		return nil
	}
	return &v1.PlanFeature{
		Id: item.ID, PlanId: item.PlanID, Feature: item.Feature, Enabled: item.Enabled,
	}
}
