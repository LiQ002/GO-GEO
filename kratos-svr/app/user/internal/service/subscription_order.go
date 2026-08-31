package service

import (
	"context"

	"google.golang.org/protobuf/types/known/timestamppb"
	v1 "kratos-svr/api/user/v1"
	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/authn"
	"kratos-svr/internal/query"
)

type SubscriptionOrderService struct {
	v1.UnimplementedSubscriptionOrderServiceServer
	uc *biz.SubscriptionOrderUsecase
}

func NewSubscriptionOrderService(uc *biz.SubscriptionOrderUsecase) *SubscriptionOrderService {
	return &SubscriptionOrderService{uc: uc}
}

func (s *SubscriptionOrderService) ListPurchasablePlans(ctx context.Context, _ *v1.ListPurchasablePlansRequest) (*v1.ListPurchasablePlansReply, error) {
	items, err := s.uc.ListPurchasablePlans(ctx)
	if err != nil {
		return nil, err
	}
	reply := &v1.ListPurchasablePlansReply{Items: make([]*v1.PurchasablePlan, 0, len(items))}
	for _, p := range items {
		reply.Items = append(reply.Items, purchasablePlanDTO(p))
	}
	return reply, nil
}

func (s *SubscriptionOrderService) CreateSubscriptionOrder(ctx context.Context, req *v1.CreateSubscriptionOrderRequest) (*v1.UserSubscriptionOrder, error) {
	p, ok := authn.PrincipalFromContext(ctx)
	if !ok {
		return nil, biz.ErrSessionInvalid
	}
	cmd := biz.UserOrderCreateCommand{
		EnterpriseID:     p.EnterpriseID,
		OrderType:        req.GetOrderType(),
		Cycle:            req.GetCycle(),
		AmountMinorUnits: req.GetAmountMinorUnits(),
		Remark:           req.GetRemark(),
	}
	if req.PlanId != nil {
		cmd.PlanID = req.PlanId
	}
	if req.CreditsAmount != nil {
		cmd.CreditsAmount = req.CreditsAmount
	}
	order, err := s.uc.CreateSubscriptionOrder(ctx, cmd)
	if err != nil {
		return nil, err
	}
	return userOrderDTO(order), nil
}

func (s *SubscriptionOrderService) ListMyOrders(ctx context.Context, req *v1.ListMyOrdersRequest) (*v1.ListMyOrdersReply, error) {
	p, ok := authn.PrincipalFromContext(ctx)
	if !ok {
		return nil, biz.ErrSessionInvalid
	}
	page, err := query.ParsePage(req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, biz.ErrSubscriptionOrderConflict
	}
	opts := biz.UserOrderListOptions{EnterpriseID: p.EnterpriseID, Offset: page.Offset, Limit: page.Limit}
	if req.OrderType != nil {
		opts.OrderType = req.GetOrderType()
	}
	items, total, err := s.uc.ListMyOrders(ctx, opts)
	if err != nil {
		return nil, err
	}
	reply := &v1.ListMyOrdersReply{Items: make([]*v1.UserSubscriptionOrder, 0, len(items)), TotalSize: total}
	for _, o := range items {
		reply.Items = append(reply.Items, userOrderDTO(o))
	}
	if page.Offset+len(items) < int(total) {
		reply.NextPageToken = query.NextToken(page.Offset + len(items))
	}
	return reply, nil
}

func (s *SubscriptionOrderService) GetMyOrder(ctx context.Context, req *v1.GetMyOrderRequest) (*v1.UserSubscriptionOrder, error) {
	p, ok := authn.PrincipalFromContext(ctx)
	if !ok {
		return nil, biz.ErrSessionInvalid
	}
	order, err := s.uc.GetMyOrder(ctx, p.EnterpriseID, req.GetId())
	if err != nil {
		return nil, err
	}
	return userOrderDTO(order), nil
}

func (s *SubscriptionOrderService) RechargeCredits(ctx context.Context, req *v1.RechargeCreditsRequest) (*v1.UserSubscriptionOrder, error) {
	p, ok := authn.PrincipalFromContext(ctx)
	if !ok {
		return nil, biz.ErrSessionInvalid
	}
	order, err := s.uc.RechargeCredits(ctx, biz.UserRechargeCommand{
		EnterpriseID:     p.EnterpriseID,
		CreditsAmount:    req.GetCreditsAmount(),
		AmountMinorUnits: req.GetAmountMinorUnits(),
		Remark:           req.GetRemark(),
	})
	if err != nil {
		return nil, err
	}
	return userOrderDTO(order), nil
}

func purchasablePlanDTO(p *biz.PurchasablePlan) *v1.PurchasablePlan {
	o := &v1.PurchasablePlan{
		Id: p.ID, Code: p.Code, Name: p.Name, Description: p.Description,
		HalfYearlyPriceMinorUnits: p.HalfYearlyPriceMinorUnits, YearlyPriceMinorUnits: p.YearlyPriceMinorUnits,
		Currency: p.Currency, BillingCycle: p.BillingCycle, SeriesCode: p.SeriesCode,
		GrantedPoints: p.GrantedPoints, SortOrder: p.SortOrder,
		Limits:   make([]*v1.PurchasablePlanLimit, 0, len(p.Limits)),
		Features: make([]*v1.PurchasablePlanFeature, 0, len(p.Features)),
	}
	for _, l := range p.Limits {
		o.Limits = append(o.Limits, &v1.PurchasablePlanLimit{Metric: l.Metric, LimitValue: l.LimitValue, Period: l.Period})
	}
	for _, f := range p.Features {
		o.Features = append(o.Features, &v1.PurchasablePlanFeature{Feature: f.Feature, Enabled: f.Enabled})
	}
	return o
}

func userOrderDTO(o *biz.UserSubscriptionOrder) *v1.UserSubscriptionOrder {
	if o == nil {
		return nil
	}
	out := &v1.UserSubscriptionOrder{
		Id: o.ID, OrderNo: o.OrderNo, EnterpriseId: o.EnterpriseID,
		OrderType: o.OrderType, Cycle: o.Cycle,
		AmountMinorUnits: o.AmountMinorUnits, Currency: o.Currency,
		Status: o.Status, Source: o.Source, Remark: o.Remark,
		PlanName: o.PlanName,
		CreatedAt: timestamppb.New(o.CreatedAt), UpdatedAt: timestamppb.New(o.UpdatedAt),
	}
	if o.PlanID != nil {
		out.PlanId = o.PlanID
	}
	if o.CreditsAmount != nil {
		out.CreditsAmount = o.CreditsAmount
	}
	return out
}
