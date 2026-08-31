package service

import (
	"context"

	v1 "kratos-svr/api/admin/v1"
	"kratos-svr/app/admin/internal/biz"
)

type BillingConfigService struct {
	v1.UnimplementedBillingConfigServiceServer
	uc *biz.BillingConfigUsecase
}

func NewBillingConfigService(uc *biz.BillingConfigUsecase) *BillingConfigService {
	return &BillingConfigService{uc: uc}
}

func (s *BillingConfigService) GetBillingUnitCosts(ctx context.Context, _ *v1.GetBillingUnitCostsRequest) (*v1.BillingUnitCostsReply, error) {
	items, err := s.uc.GetUnitCosts(ctx)
	if err != nil {
		return nil, err
	}
	reply := &v1.BillingUnitCostsReply{Items: make([]*v1.BillingUnitCost, 0, len(items))}
	for _, c := range items {
		reply.Items = append(reply.Items, unitCostDTO(c))
	}
	return reply, nil
}

func (s *BillingConfigService) UpdateBillingUnitCost(ctx context.Context, req *v1.UpdateBillingUnitCostRequest) (*v1.BillingUnitCostsReply, error) {
	op, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	items, err := s.uc.UpdateUnitCost(ctx, req.GetAction(), req.GetPoints(), req.GetChargeType(), req.GetQuotaMetric(), op, req.GetReason())
	if err != nil {
		return nil, err
	}
	reply := &v1.BillingUnitCostsReply{Items: make([]*v1.BillingUnitCost, 0, len(items))}
	for _, c := range items {
		reply.Items = append(reply.Items, unitCostDTO(c))
	}
	return reply, nil
}

func (s *BillingConfigService) ResetBillingUnitCosts(ctx context.Context, req *v1.ResetBillingUnitCostsRequest) (*v1.BillingUnitCostsReply, error) {
	op, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	items, err := s.uc.ResetUnitCosts(ctx, op, req.GetReason())
	if err != nil {
		return nil, err
	}
	reply := &v1.BillingUnitCostsReply{Items: make([]*v1.BillingUnitCost, 0, len(items))}
	for _, c := range items {
		reply.Items = append(reply.Items, unitCostDTO(c))
	}
	return reply, nil
}

func (s *BillingConfigService) GetActionRegistry(ctx context.Context, _ *v1.GetActionRegistryRequest) (*v1.ActionRegistryReply, error) {
	items, err := s.uc.GetActionRegistry(ctx)
	if err != nil {
		return nil, err
	}
	reply := &v1.ActionRegistryReply{Items: make([]*v1.ActionRegistryEntry, 0, len(items))}
	for _, e := range items {
		reply.Items = append(reply.Items, &v1.ActionRegistryEntry{
			Action: e.Action, Implemented: e.Implemented, BizEntry: e.BizEntry, Status: e.Status,
		})
	}
	return reply, nil
}

func unitCostDTO(c *biz.UnitCost) *v1.BillingUnitCost {
	return &v1.BillingUnitCost{
		Action: c.Action, Title: c.Title, Points: c.Points,
		Unit: c.Unit, ChargeType: c.ChargeType, QuotaMetric: c.QuotaMetric,
	}
}
