package biz

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/go-kratos/kratos/v3/errors"
)

// --- SubscriptionOrderUsecase ---

// SubscriptionOrderUsecase 编排订单全生命周期（见设计文档 §7）。
type SubscriptionOrderUsecase struct {
	orderRepo SubscriptionOrderRepo
	planRepo  PlanRepo
	txRepo    BillingTxRepo
}

func NewSubscriptionOrderUsecase(orderRepo SubscriptionOrderRepo, planRepo PlanRepo, txRepo BillingTxRepo) *SubscriptionOrderUsecase {
	return &SubscriptionOrderUsecase{orderRepo: orderRepo, planRepo: planRepo, txRepo: txRepo}
}

func (uc *SubscriptionOrderUsecase) List(ctx context.Context, opts SubscriptionOrderListOptions) ([]*SubscriptionOrder, int64, error) {
	if opts.Limit <= 0 || opts.Limit > 200 {
		opts.Limit = 20
	}
	return uc.orderRepo.List(ctx, opts)
}

func (uc *SubscriptionOrderUsecase) Get(ctx context.Context, id uint64) (*SubscriptionOrder, error) {
	if id == 0 {
		return nil, ErrSubscriptionOrderInvalid
	}
	return uc.orderRepo.Get(ctx, id)
}

// OpenPlan 管理员开通套餐：创建 plan 订单 → 创建/替换订阅 → 种子化 quota → 发放赠送点数。
func (uc *SubscriptionOrderUsecase) OpenPlan(ctx context.Context, cmd OpenPlanCommand) (*SubscriptionOrder, error) {
	if cmd.EnterpriseID == 0 || cmd.PlanID == 0 || cmd.OperatorID == 0 {
		return nil, ErrSubscriptionOrderInvalid
	}
	if cmd.Cycle == "" {
		cmd.Cycle = "yearly"
	}
	if cmd.Source == "" {
		cmd.Source = OrderSourceAdminGrant
	}
	plan, err := uc.planRepo.Get(ctx, cmd.PlanID)
	if err != nil {
		return nil, err
	}
	if plan.Status != PlanStatusActive {
		return nil, ErrSubscriptionOrderInvalid
	}
	return uc.txRepo.ExecuteOpenPlan(ctx, cmd)
}

// RenewSubscription 续费：创建 renew 订单 → 延长订阅 expires_at。
func (uc *SubscriptionOrderUsecase) RenewSubscription(ctx context.Context, cmd RenewCommand) (*SubscriptionOrder, error) {
	if cmd.EnterpriseID == 0 || cmd.PlanID == 0 || cmd.OperatorID == 0 {
		return nil, ErrSubscriptionOrderInvalid
	}
	if cmd.Cycle == "" {
		cmd.Cycle = "yearly"
	}
	if cmd.Source == "" {
		cmd.Source = OrderSourceAdminGrant
	}
	if _, err := uc.planRepo.Get(ctx, cmd.PlanID); err != nil {
		return nil, err
	}
	return uc.txRepo.ExecuteRenew(ctx, cmd)
}

// AddonQuota 加购额度：创建 addon 订单 → 增加 quota_limits.limit_value。
func (uc *SubscriptionOrderUsecase) AddonQuota(ctx context.Context, cmd AddonCommand) (*SubscriptionOrder, error) {
	if cmd.EnterpriseID == 0 || strings.TrimSpace(cmd.AddonQuotaMetric) == "" || cmd.AddonQuotaAmount <= 0 || cmd.OperatorID == 0 {
		return nil, ErrSubscriptionOrderInvalid
	}
	if cmd.Source == "" {
		cmd.Source = OrderSourceAdminGrant
	}
	return uc.txRepo.ExecuteAddon(ctx, cmd)
}

// RechargeCredits 充值点数：创建 credits 订单 → 增加 balance → 写 recharge 流水。
func (uc *SubscriptionOrderUsecase) RechargeCredits(ctx context.Context, cmd RechargeCommand) (*SubscriptionOrder, error) {
	if cmd.EnterpriseID == 0 || cmd.CreditsAmount <= 0 || cmd.OperatorID == 0 {
		return nil, ErrSubscriptionOrderInvalid
	}
	if cmd.Source == "" {
		cmd.Source = OrderSourceAdminGrant
	}
	return uc.txRepo.ExecuteRecharge(ctx, cmd)
}

// RefundOrder 退款：创建 refund 订单 → 扣减点数/额度 → 写 refund 流水。
func (uc *SubscriptionOrderUsecase) RefundOrder(ctx context.Context, cmd RefundCommand) (*SubscriptionOrder, error) {
	if cmd.RefundReferenceOrderID == 0 || cmd.OperatorID == 0 {
		return nil, ErrSubscriptionOrderInvalid
	}
	ref, err := uc.orderRepo.Get(ctx, cmd.RefundReferenceOrderID)
	if err != nil {
		return nil, err
	}
	if ref.Status != OrderStatusApproved {
		return nil, ErrSubscriptionOrderConflict
	}
	return uc.txRepo.ExecuteRefund(ctx, cmd)
}

// ConfirmReceipt 确认到账：pending → approved，并对 plan/renew/addon/credits 类订单执行副作用。
func (uc *SubscriptionOrderUsecase) ConfirmReceipt(ctx context.Context, id, operatorID uint64, remark string) (*SubscriptionOrder, error) {
	if id == 0 || operatorID == 0 {
		return nil, ErrSubscriptionOrderInvalid
	}
	order, err := uc.orderRepo.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	if order.Status != OrderStatusPending {
		return nil, ErrSubscriptionOrderConflict
	}
	now := time.Now().UTC()
	order.Status = OrderStatusApproved
	order.ApprovedAt = &now
	order.ApprovedBy = &operatorID
	if remark != "" {
		order.Remark = remark
	}
	return uc.orderRepo.Update(ctx, order)
}

// CancelOrder 取消订单：pending → cancelled。
func (uc *SubscriptionOrderUsecase) CancelOrder(ctx context.Context, id, operatorID uint64, remark string) (*SubscriptionOrder, error) {
	if id == 0 || operatorID == 0 {
		return nil, ErrSubscriptionOrderInvalid
	}
	order, err := uc.orderRepo.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	if order.Status != OrderStatusPending {
		return nil, ErrSubscriptionOrderConflict
	}
	order.Status = OrderStatusCancelled
	if remark != "" {
		order.Remark = remark
	}
	return uc.orderRepo.Update(ctx, order)
}

// --- BillingConfigUsecase ---

// BillingConfigUsecase 管理计费项单价与注册表（见设计文档 §4.5/§4.6）。
type BillingConfigUsecase struct {
	settingRepo SystemSettingRepo
}

func NewBillingConfigUsecase(settingRepo SystemSettingRepo) *BillingConfigUsecase {
	return &BillingConfigUsecase{settingRepo: settingRepo}
}

// UnitCost 单项计费单价（运行时换算毫点）。
type UnitCost struct {
	Action      string  `json:"action"`
	Title       string  `json:"title"`
	Points      float64 `json:"points"`
	Unit        string  `json:"unit"`
	ChargeType  string  `json:"charge_type"`
	QuotaMetric string  `json:"quota_metric"`
}

// ActionRegistryEntry 计费项注册表条目。
type ActionRegistryEntry struct {
	Action     string `json:"action"`
	Implemented bool  `json:"implemented"`
	BizEntry   string `json:"biz_entry"`
	Status     string `json:"status"`
}

// GetUnitCosts 读取 billing.unit_costs 配置。
func (uc *BillingConfigUsecase) GetUnitCosts(ctx context.Context) ([]*UnitCost, error) {
	setting, err := uc.findBillingSetting(ctx, "unit_costs")
	if err != nil {
		return nil, err
	}
	return parseUnitCosts(setting.ValueJSON)
}

// UpdateUnitCost 更新单项计费单价。
func (uc *BillingConfigUsecase) UpdateUnitCost(ctx context.Context, action string, points float64, chargeType, quotaMetric string, operatorID uint64, reason string) ([]*UnitCost, error) {
	if strings.TrimSpace(action) == "" || operatorID == 0 || strings.TrimSpace(reason) == "" {
		return nil, ErrSystemSettingInvalid
	}
	setting, err := uc.findBillingSetting(ctx, "unit_costs")
	if err != nil {
		return nil, err
	}
	costs, err := parseUnitCosts(setting.ValueJSON)
	if err != nil {
		return nil, err
	}
	found := false
	for _, c := range costs {
		if c.Action == action {
			c.Points = points
			if chargeType != "" {
				c.ChargeType = chargeType
			}
			if quotaMetric != "" {
				c.QuotaMetric = quotaMetric
			}
			found = true
			break
		}
	}
	if !found {
		return nil, errors.BadRequest("BILLING_ACTION_NOT_FOUND", fmt.Sprintf("action %q not found in unit_costs", action))
	}
	newJSON, err := serializeUnitCosts(costs)
	if err != nil {
		return nil, err
	}
	setting.ValueJSON = string(newJSON)
	if _, err := uc.settingRepo.Update(ctx, SystemSettingCommand{Setting: setting, OperatorID: operatorID, Reason: reason}); err != nil {
		return nil, err
	}
	return costs, nil
}

// ResetUnitCosts 恢复默认单价。
func (uc *BillingConfigUsecase) ResetUnitCosts(ctx context.Context, operatorID uint64, reason string) ([]*UnitCost, error) {
	if operatorID == 0 || strings.TrimSpace(reason) == "" {
		return nil, ErrSystemSettingInvalid
	}
	setting, err := uc.findBillingSetting(ctx, "unit_costs")
	if err != nil {
		return nil, err
	}
	setting.ValueJSON = defaultUnitCostsJSON
	if _, err := uc.settingRepo.Update(ctx, SystemSettingCommand{Setting: setting, OperatorID: operatorID, Reason: reason}); err != nil {
		return nil, err
	}
	return parseUnitCosts(setting.ValueJSON)
}

// GetActionRegistry 读取 billing.action_registry 配置。
func (uc *BillingConfigUsecase) GetActionRegistry(ctx context.Context) ([]*ActionRegistryEntry, error) {
	setting, err := uc.findBillingSetting(ctx, "action_registry")
	if err != nil {
		return nil, err
	}
	return parseActionRegistry(setting.ValueJSON)
}

func (uc *BillingConfigUsecase) findBillingSetting(ctx context.Context, key string) (*SystemSetting, error) {
	items, _, err := uc.settingRepo.List(ctx, SystemSettingListOptions{Namespace: "billing", Keyword: key, Limit: 100})
	if err != nil {
		return nil, err
	}
	for _, s := range items {
		if s.Key == key {
			return s, nil
		}
	}
	return nil, ErrSystemSettingNotFound
}
