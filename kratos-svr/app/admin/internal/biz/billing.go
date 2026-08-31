package biz

import (
	"context"
	"time"

	"github.com/go-kratos/kratos/v3/errors"
)

// 订单类型：一张表承载五类交易（见设计文档 §4.2）。
const (
	OrderTypePlan    = "plan"    // 开通套餐
	OrderTypeRenew   = "renew"   // 续费
	OrderTypeAddon   = "addon"   // 加购额度
	OrderTypeCredits = "credits" // 充值点数
	OrderTypeRefund  = "refund"  // 退款
)

// 订单状态（见设计文档 §7.1 状态机）。
const (
	OrderStatusPending  = "pending"  // 待确认
	OrderStatusPaid     = "paid"     // 已支付（预留支付流程）
	OrderStatusApproved = "approved" // 已确认/已到账
	OrderStatusCancelled = "cancelled" // 已取消
	OrderStatusRefunded = "refunded"   // 已退款
)

// 订单来源（见设计文档 §7.3）。
const (
	OrderSourceEnterpriseSelf = "enterprise_self" // 企业自购
	OrderSourceAdminGrant     = "admin_grant"     // 管理员开通
	OrderSourceAdminEdit      = "admin_edit"      // 管理员编辑
)

// 点数流水操作类型（见设计文档 §4.4）。
const (
	PointsOperationGrant    = "grant"    // 赠送
	PointsOperationRecharge = "recharge" // 充值
	PointsOperationReserve  = "reserve"  // 预扣
	PointsOperationSettle   = "settle"   // 扣减
	PointsOperationRollback = "rollback" // 回滚
	PointsOperationRefund   = "refund"   // 退款扣减
	PointsOperationAdjust   = "adjust"   // 管理员调整
)

// 订阅状态（见设计文档 §15.1）。
const (
	SubscriptionStatusActive  = "active"
	SubscriptionStatusExpired = "expired"
)

var (
	ErrSubscriptionOrderNotFound = errors.NotFound("SUBSCRIPTION_ORDER_NOT_FOUND", "subscription order not found")
	ErrSubscriptionOrderInvalid  = errors.BadRequest("SUBSCRIPTION_ORDER_INVALID", "invalid subscription order data")
	ErrSubscriptionOrderConflict = errors.Conflict("SUBSCRIPTION_ORDER_CONFLICT", "subscription order state conflict")
	ErrPointsBalanceNotFound     = errors.NotFound("POINTS_BALANCE_NOT_FOUND", "points balance not found")
	ErrPointsInsufficient        = errors.BadRequest("POINTS_INSUFFICIENT", "点数余额不足，请充值点数或升级套餐")
)

// SubscriptionOrder is the unified order DO for plan/renew/addon/credits/refund.
// 一张订单表驱动所有交易，用 order_type 区分（见设计文档 §4.2）。
type SubscriptionOrder struct {
	ID                      uint64
	OrderNo                 string
	EnterpriseID            uint64
	PlanID                  *uint64
	OrderType               string
	Cycle                   string
	AmountMinorUnits        int64
	Currency                string
	CreditsAmount           *int64
	AddonQuotaMetric        string
	AddonQuotaAmount        *int64
	RenewFromSubscriptionID *uint64
	RefundReferenceOrderID  *uint64
	PointsBefore            *int64
	PointsAfter             *int64
	Status                  string
	Source                  string
	PaidAt                  *time.Time
	ApprovedAt              *time.Time
	ApprovedBy              *uint64
	Remark                  string
	CreatedAt               time.Time
	UpdatedAt               time.Time
	PlanName                string
	EnterpriseName          string
}

// SubscriptionOrderListOptions filters orders for admin listing.
type SubscriptionOrderListOptions struct {
	Offset, Limit int
	EnterpriseID  uint64
	OrderType     string
	Status        string
	Source        string
	Keyword       string // search by order_no
}

// SubscriptionOrderRepo manages ent_subscription_orders.
type SubscriptionOrderRepo interface {
	Create(context.Context, *SubscriptionOrder) (*SubscriptionOrder, error)
	Get(context.Context, uint64) (*SubscriptionOrder, error)
	GetByOrderNo(context.Context, string) (*SubscriptionOrder, error)
	List(context.Context, SubscriptionOrderListOptions) ([]*SubscriptionOrder, int64, error)
	Update(context.Context, *SubscriptionOrder) (*SubscriptionOrder, error)
}

// PointsBalance is the per-enterprise points wallet DO (milli-points).
// 余额与流水分离：本 DO 用于快速校验，PointsLedger 用于对账（见设计文档 §4.3）。
type PointsBalance struct {
	ID           uint64
	EnterpriseID uint64
	Balance      int64
	Frozen       int64
	Version      uint64
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// PointsLedger is an append-only points adjustment DO (见设计文档 §4.4)。
type PointsLedger struct {
	ID             uint64
	EnterpriseID   uint64
	Operation      string
	Amount         int64
	BalanceAfter   int64
	FrozenAfter    int64
	ReferenceType  string
	ReferenceID    *uint64
	Reason         string
	OperatorID     *uint64
	IdempotencyKey string
	CreatedAt      time.Time
}

// PointsBalanceRepo manages ent_points_balances.
type PointsBalanceRepo interface {
	Get(context.Context, uint64) (*PointsBalance, error)
	Upsert(context.Context, *PointsBalance) (*PointsBalance, error)
}

// PointsLedgerRepo manages ent_points_ledgers (append-only).
type PointsLedgerRepo interface {
	Create(context.Context, *PointsLedger) (*PointsLedger, error)
	List(context.Context, uint64, int, int) ([]*PointsLedger, int64, error)
}

// BillingTxRepo executes cross-table order orchestrations in a single transaction.
// 每个方法封装一类订单的完整编排（见设计文档 §7）：创建订单 → 更新订阅/配额/点数 → 写流水。
type BillingTxRepo interface {
	// ExecuteOpenPlan 开通套餐：创建 plan 订单 → 创建/替换订阅 → 种子化 quota_limits → 发放赠送点数。
	ExecuteOpenPlan(ctx context.Context, cmd OpenPlanCommand) (*SubscriptionOrder, error)
	// ExecuteRenew 续费：创建 renew 订单 → 延长订阅 expires_at。
	ExecuteRenew(ctx context.Context, cmd RenewCommand) (*SubscriptionOrder, error)
	// ExecuteAddon 加购额度：创建 addon 订单 → 增加 quota_limits.limit_value。
	ExecuteAddon(ctx context.Context, cmd AddonCommand) (*SubscriptionOrder, error)
	// ExecuteRecharge 充值点数：创建 credits 订单 → 增加 points_balances.balance → 写 recharge 流水。
	ExecuteRecharge(ctx context.Context, cmd RechargeCommand) (*SubscriptionOrder, error)
	// ExecuteRefund 退款：创建 refund 订单 → 扣减点数/额度 → 写 refund 流水。
	ExecuteRefund(ctx context.Context, cmd RefundCommand) (*SubscriptionOrder, error)
}

// OpenPlanCommand 开通套餐参数。
type OpenPlanCommand struct {
	EnterpriseID uint64
	PlanID       uint64
	Cycle        string // half_yearly / yearly
	OperatorID   uint64
	Source       string // admin_grant / enterprise_self
	Remark       string
}

// RenewCommand 续费参数。
type RenewCommand struct {
	EnterpriseID           uint64
	PlanID                 uint64
	Cycle                  string
	RenewFromSubscriptionID *uint64
	OperatorID             uint64
	Source                 string
	Remark                 string
}

// AddonCommand 加购额度参数。
type AddonCommand struct {
	EnterpriseID      uint64
	AddonQuotaMetric  string
	AddonQuotaAmount  int64
	AmountMinorUnits  int64
	OperatorID        uint64
	Source            string
	Remark            string
}

// RechargeCommand 充值点数参数。
type RechargeCommand struct {
	EnterpriseID      uint64
	CreditsAmount     int64 // 毫点
	AmountMinorUnits  int64 // 金额（分）
	OperatorID        uint64
	Source            string
	Remark            string
}

// RefundCommand 退款参数。
type RefundCommand struct {
	RefundReferenceOrderID uint64
	OperatorID             uint64
	Remark                 string
}
