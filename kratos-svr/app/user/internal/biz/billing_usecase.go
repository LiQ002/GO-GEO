package biz

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// 订单类型与状态常量（与 admin 侧保持一致，user 侧独立定义避免跨包依赖）。
const (
	UserOrderTypePlan    = "plan"
	UserOrderTypeRenew   = "renew"
	UserOrderTypeAddon   = "addon"
	UserOrderTypeCredits = "credits"

	UserOrderStatusPending   = "pending"
	UserOrderStatusApproved  = "approved"
	UserOrderStatusCancelled = "cancelled"

	UserOrderSourceEnterpriseSelf = "enterprise_self"
)

// UserOrderCreateCommand 创建订单参数（企业自购）。
type UserOrderCreateCommand struct {
	EnterpriseID     uint64
	PlanID           *uint64
	OrderType        string
	Cycle            string
	AmountMinorUnits int64
	CreditsAmount    *int64
	Remark           string
}

// UserRechargeCommand 充值参数。
type UserRechargeCommand struct {
	EnterpriseID     uint64
	CreditsAmount    int64
	AmountMinorUnits int64
	Remark           string
}

// SubscriptionOrderUsecase 编排企业端自助订单（见设计文档 §11）。
type SubscriptionOrderUsecase struct {
	planRepo  PurchasablePlanRepo
	orderRepo UserSubscriptionOrderRepo
}

func NewSubscriptionOrderUsecase(planRepo PurchasablePlanRepo, orderRepo UserSubscriptionOrderRepo) *SubscriptionOrderUsecase {
	return &SubscriptionOrderUsecase{planRepo: planRepo, orderRepo: orderRepo}
}

// ListPurchasablePlans 查询可购套餐列表。
func (uc *SubscriptionOrderUsecase) ListPurchasablePlans(ctx context.Context) ([]*PurchasablePlan, error) {
	return uc.planRepo.ListPurchasable(ctx)
}

// CreateSubscriptionOrder 企业自购下单：创建 pending 订单，等待管理员确认到账。
func (uc *SubscriptionOrderUsecase) CreateSubscriptionOrder(ctx context.Context, cmd UserOrderCreateCommand) (*UserSubscriptionOrder, error) {
	if cmd.EnterpriseID == 0 || strings.TrimSpace(cmd.OrderType) == "" {
		return nil, ErrSubscriptionOrderConflict
	}
	// 验证套餐存在且可购
	if cmd.PlanID != nil {
		plans, err := uc.planRepo.ListPurchasable(ctx)
		if err != nil {
			return nil, err
		}
		found := false
		for _, p := range plans {
			if p.ID == *cmd.PlanID {
				found = true
				break
			}
		}
		if !found {
			return nil, ErrSubscriptionOrderConflict
		}
	}
	now := time.Now().UTC()
	order := &UserSubscriptionOrder{
		OrderNo:          generateUserOrderNo(cmd.OrderType),
		EnterpriseID:     cmd.EnterpriseID,
		PlanID:           cmd.PlanID,
		OrderType:        cmd.OrderType,
		Cycle:            cmd.Cycle,
		AmountMinorUnits: cmd.AmountMinorUnits,
		Currency:         "CNY",
		CreditsAmount:    cmd.CreditsAmount,
		Status:           UserOrderStatusPending,
		Source:           UserOrderSourceEnterpriseSelf,
		Remark:           cmd.Remark,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	return uc.orderRepo.Create(ctx, order)
}

// ListMyOrders 查询当前企业的订单列表。
func (uc *SubscriptionOrderUsecase) ListMyOrders(ctx context.Context, opts UserOrderListOptions) ([]*UserSubscriptionOrder, int64, error) {
	if opts.EnterpriseID == 0 {
		return nil, 0, ErrSubscriptionOrderConflict
	}
	if opts.Limit <= 0 || opts.Limit > 100 {
		opts.Limit = 20
	}
	return uc.orderRepo.List(ctx, opts)
}

// GetMyOrder 获取当前企业的订单详情。
func (uc *SubscriptionOrderUsecase) GetMyOrder(ctx context.Context, enterpriseID, orderID uint64) (*UserSubscriptionOrder, error) {
	if enterpriseID == 0 || orderID == 0 {
		return nil, ErrSubscriptionOrderConflict
	}
	return uc.orderRepo.Get(ctx, enterpriseID, orderID)
}

// RechargeCredits 企业自助充值点数：创建 pending 充值订单，等待管理员确认到账。
func (uc *SubscriptionOrderUsecase) RechargeCredits(ctx context.Context, cmd UserRechargeCommand) (*UserSubscriptionOrder, error) {
	if cmd.EnterpriseID == 0 || cmd.CreditsAmount <= 0 {
		return nil, ErrSubscriptionOrderConflict
	}
	now := time.Now().UTC()
	credits := cmd.CreditsAmount
	order := &UserSubscriptionOrder{
		OrderNo:          generateUserOrderNo(UserOrderTypeCredits),
		EnterpriseID:     cmd.EnterpriseID,
		OrderType:        UserOrderTypeCredits,
		AmountMinorUnits: cmd.AmountMinorUnits,
		Currency:         "CNY",
		CreditsAmount:    &credits,
		Status:           UserOrderStatusPending,
		Source:           UserOrderSourceEnterpriseSelf,
		Remark:           cmd.Remark,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	return uc.orderRepo.Create(ctx, order)
}

// generateUserOrderNo 生成订单号：前缀 + 年月日时分秒 + 微秒。
func generateUserOrderNo(orderType string) string {
	prefix := "OR"
	switch orderType {
	case UserOrderTypePlan:
		prefix = "PL"
	case UserOrderTypeRenew:
		prefix = "RN"
	case UserOrderTypeAddon:
		prefix = "AD"
	case UserOrderTypeCredits:
		prefix = "CR"
	}
	now := time.Now().UTC()
	return fmt.Sprintf("%s%s%06d", prefix, now.Format("20060102150405"), now.Nanosecond()/1000%1000000)
}
