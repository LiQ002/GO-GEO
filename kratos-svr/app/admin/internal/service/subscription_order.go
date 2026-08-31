package service

import (
	"context"

	"google.golang.org/protobuf/types/known/timestamppb"
	v1 "kratos-svr/api/admin/v1"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/query"
)

type SubscriptionOrderService struct {
	v1.UnimplementedSubscriptionOrderServiceServer
	uc         *biz.SubscriptionOrderUsecase
	planUC     *biz.PlanUsecase
	enterpriseUC *biz.EnterpriseUsecase
}

func NewSubscriptionOrderService(
	uc *biz.SubscriptionOrderUsecase,
	planUC *biz.PlanUsecase,
	enterpriseUC *biz.EnterpriseUsecase,
) *SubscriptionOrderService {
	return &SubscriptionOrderService{uc: uc, planUC: planUC, enterpriseUC: enterpriseUC}
}

func (s *SubscriptionOrderService) ListSubscriptionOrders(ctx context.Context, req *v1.ListSubscriptionOrdersRequest) (*v1.ListSubscriptionOrdersReply, error) {
	page, err := query.ParsePage(req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, biz.ErrSubscriptionOrderInvalid
	}
	opts := biz.SubscriptionOrderListOptions{
		Offset: page.Offset, Limit: page.Limit,
		Keyword: req.GetKeyword(),
	}
	if req.EnterpriseId != nil {
		opts.EnterpriseID = req.GetEnterpriseId()
	}
	if req.OrderType != nil {
		opts.OrderType = req.GetOrderType()
	}
	if req.Status != nil {
		opts.Status = req.GetStatus()
	}
	if req.Source != nil {
		opts.Source = req.GetSource()
	}
	items, total, err := s.uc.List(ctx, opts)
	if err != nil {
		return nil, err
	}
	reply := &v1.ListSubscriptionOrdersReply{Items: make([]*v1.SubscriptionOrder, 0, len(items)), TotalSize: total}
	for _, item := range items {
		reply.Items = append(reply.Items, s.subscriptionOrderDTO(ctx, item))
	}
	if page.Offset+len(items) < int(total) {
		reply.NextPageToken = query.NextToken(page.Offset + len(items))
	}
	return reply, nil
}

func (s *SubscriptionOrderService) GetSubscriptionOrder(ctx context.Context, req *v1.GetSubscriptionOrderRequest) (*v1.SubscriptionOrder, error) {
	item, err := s.uc.Get(ctx, req.GetId())
	if err != nil {
		return nil, err
	}
	return s.subscriptionOrderDTO(ctx, item), nil
}

func (s *SubscriptionOrderService) ConfirmReceipt(ctx context.Context, req *v1.ConfirmReceiptRequest) (*v1.SubscriptionOrder, error) {
	op, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	item, err := s.uc.ConfirmReceipt(ctx, req.GetId(), op, req.GetRemark())
	if err != nil {
		return nil, err
	}
	return s.subscriptionOrderDTO(ctx, item), nil
}

func (s *SubscriptionOrderService) CancelOrder(ctx context.Context, req *v1.CancelOrderRequest) (*v1.SubscriptionOrder, error) {
	op, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	item, err := s.uc.CancelOrder(ctx, req.GetId(), op, req.GetRemark())
	if err != nil {
		return nil, err
	}
	return s.subscriptionOrderDTO(ctx, item), nil
}

func (s *SubscriptionOrderService) OpenPlan(ctx context.Context, req *v1.OpenPlanRequest) (*v1.SubscriptionOrder, error) {
	op, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	item, err := s.uc.OpenPlan(ctx, biz.OpenPlanCommand{
		EnterpriseID: req.GetEnterpriseId(),
		PlanID:       req.GetPlanId(),
		Cycle:        req.GetCycle(),
		OperatorID:   op,
		Remark:       req.GetRemark(),
	})
	if err != nil {
		return nil, err
	}
	return s.subscriptionOrderDTO(ctx, item), nil
}

func (s *SubscriptionOrderService) RenewSubscription(ctx context.Context, req *v1.RenewSubscriptionRequest) (*v1.SubscriptionOrder, error) {
	op, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	cmd := biz.RenewCommand{
		EnterpriseID: req.GetEnterpriseId(),
		PlanID:       req.GetPlanId(),
		Cycle:        req.GetCycle(),
		OperatorID:   op,
		Remark:       req.GetRemark(),
	}
	if req.RenewFromSubscriptionId != nil {
		cmd.RenewFromSubscriptionID = req.RenewFromSubscriptionId
	}
	item, err := s.uc.RenewSubscription(ctx, cmd)
	if err != nil {
		return nil, err
	}
	return s.subscriptionOrderDTO(ctx, item), nil
}

func (s *SubscriptionOrderService) AddonQuota(ctx context.Context, req *v1.AddonQuotaRequest) (*v1.SubscriptionOrder, error) {
	op, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	item, err := s.uc.AddonQuota(ctx, biz.AddonCommand{
		EnterpriseID:     req.GetEnterpriseId(),
		AddonQuotaMetric: req.GetAddonQuotaMetric(),
		AddonQuotaAmount: req.GetAddonQuotaAmount(),
		AmountMinorUnits: req.GetAmountMinorUnits(),
		OperatorID:       op,
		Remark:           req.GetRemark(),
	})
	if err != nil {
		return nil, err
	}
	return s.subscriptionOrderDTO(ctx, item), nil
}

func (s *SubscriptionOrderService) RechargeCredits(ctx context.Context, req *v1.RechargeCreditsRequest) (*v1.SubscriptionOrder, error) {
	op, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	item, err := s.uc.RechargeCredits(ctx, biz.RechargeCommand{
		EnterpriseID:     req.GetEnterpriseId(),
		CreditsAmount:    req.GetCreditsAmount(),
		AmountMinorUnits: req.GetAmountMinorUnits(),
		OperatorID:       op,
		Remark:           req.GetRemark(),
	})
	if err != nil {
		return nil, err
	}
	return s.subscriptionOrderDTO(ctx, item), nil
}

func (s *SubscriptionOrderService) RefundOrder(ctx context.Context, req *v1.RefundOrderRequest) (*v1.SubscriptionOrder, error) {
	op, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	item, err := s.uc.RefundOrder(ctx, biz.RefundCommand{
		RefundReferenceOrderID: req.GetRefundReferenceOrderId(),
		OperatorID:             op,
		Remark:                 req.GetRemark(),
	})
	if err != nil {
		return nil, err
	}
	return s.subscriptionOrderDTO(ctx, item), nil
}

func (s *SubscriptionOrderService) subscriptionOrderDTO(ctx context.Context, item *biz.SubscriptionOrder) *v1.SubscriptionOrder {
	if item == nil {
		return nil
	}
	o := &v1.SubscriptionOrder{
		Id: item.ID, OrderNo: item.OrderNo, EnterpriseId: item.EnterpriseID,
		OrderType: item.OrderType, Cycle: item.Cycle,
		AmountMinorUnits: item.AmountMinorUnits, Currency: item.Currency,
		AddonQuotaMetric: item.AddonQuotaMetric,
		Status: item.Status, Source: item.Source,
		Remark: item.Remark,
		CreatedAt: timestamppb.New(item.CreatedAt), UpdatedAt: timestamppb.New(item.UpdatedAt),
	}
	if item.PlanID != nil {
		o.PlanId = item.PlanID
	}
	if item.CreditsAmount != nil {
		o.CreditsAmount = item.CreditsAmount
	}
	if item.AddonQuotaAmount != nil {
		o.AddonQuotaAmount = item.AddonQuotaAmount
	}
	if item.RenewFromSubscriptionID != nil {
		o.RenewFromSubscriptionId = item.RenewFromSubscriptionID
	}
	if item.RefundReferenceOrderID != nil {
		o.RefundReferenceOrderId = item.RefundReferenceOrderID
	}
	if item.PointsBefore != nil {
		o.PointsBefore = item.PointsBefore
	}
	if item.PointsAfter != nil {
		o.PointsAfter = item.PointsAfter
	}
	if item.PaidAt != nil {
		o.PaidAt = timestamppb.New(*item.PaidAt)
	}
	if item.ApprovedAt != nil {
		o.ApprovedAt = timestamppb.New(*item.ApprovedAt)
	}
	if item.ApprovedBy != nil {
		o.ApprovedBy = item.ApprovedBy
	}

	// 填充企业名
	enterpriseName := item.EnterpriseName
	if enterpriseName == "" && item.EnterpriseID != 0 {
		if detail, err := s.enterpriseUC.Get(ctx, item.EnterpriseID); err == nil && detail != nil {
			enterpriseName = detail.Enterprise.Name
		}
	}
	o.EnterpriseName = enterpriseName

	// 填充套餐名
	planName := item.PlanName
	if planName == "" && item.PlanID != nil && *item.PlanID != 0 {
		if plan, err := s.planUC.Get(ctx, *item.PlanID); err == nil && plan != nil {
			planName = plan.Name
		}
	}
	o.PlanName = planName

	return o
}
