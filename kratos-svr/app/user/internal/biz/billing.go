package biz

import (
	"context"
	"time"

	"github.com/go-kratos/kratos/v3/errors"
)

var (
	ErrBillingActionReserved     = errors.BadRequest("BILLING_ACTION_RESERVED", "billing action is reserved and not yet implemented")
	ErrBillingConfigMissing      = errors.NotFound("BILLING_CONFIG_MISSING", "billing configuration not found")
	ErrSubscriptionExpired       = errors.Forbidden("SUBSCRIPTION_EXPIRED", "订阅已过期，请续费后继续使用")
	ErrQuotaExhausted            = errors.Forbidden("QUOTA_EXHAUSTED", "达到套餐设定额度，请升级套餐或联系管理员")
	// ErrArticleGenerationsQuotaExceeded 词条数（article_generations）配额超限专用错误。
	// 文案提示用户可通过删除多余词条来腾出空间，比通用的"联系管理员"更具体可操作。
	// 适用场景：AI 蒸馏问题、手动添加问题，对应 article_generations metric。
	ErrArticleGenerationsQuotaExceeded = errors.Forbidden("ARTICLE_GENERATIONS_QUOTA_EXCEEDED", "达到套餐设定额度，请升级套餐或管理词条")
	ErrSubscriptionOrderNotFound = errors.NotFound("SUBSCRIPTION_ORDER_NOT_FOUND", "subscription order not found")
	ErrSubscriptionOrderConflict = errors.Conflict("SUBSCRIPTION_ORDER_CONFLICT", "subscription order state conflict")
	ErrBrandKeywordQuotaExceeded = errors.Forbidden("BRAND_KEYWORD_QUOTA_EXCEEDED", "达到套餐设定额度，请升级套餐或联系管理员")
	ErrKeywordQuotaExceeded      = errors.Forbidden("KEYWORD_QUOTA_EXCEEDED", "达到套餐设定额度，请升级套餐或联系管理员")
	ErrGeoQuotaExceeded          = errors.Forbidden("GEO_QUOTA_EXCEEDED", "达到套餐设定额度，请升级套餐或联系管理员")
	ErrPointsInsufficient        = errors.Forbidden("POINTS_INSUFFICIENT", "点数余额不足，请充值点数或升级套餐")
	ErrBillingConfigParse        = errors.InternalServer("BILLING_CONFIG_PARSE", "计费配置解析失败")
)

// 点数流水操作类型（与 admin 端常量保持一致）。
const (
	PointsOperationGrant    = "grant"    // 赠送
	PointsOperationRecharge = "recharge" // 充值
	PointsOperationReserve  = "reserve"  // 预扣
	PointsOperationSettle   = "settle"   // 扣减
	PointsOperationRollback = "rollback" // 回滚
	PointsOperationRefund   = "refund"   // 退款扣减
	PointsOperationAdjust   = "adjust"   // 管理员调整
)

// BillingService is the unified billing service for dual-ledger (quota + points) deduction.
// 升级现有 reserveQuota 自由函数为接口，同时处理额度与点数（见设计文档 §8）。
// 由各业务 usecase 调用，不直接暴露给前端。
type BillingService interface {
	// Estimate 估算成本（不扣减），用于前端预览与拦截判断。
	Estimate(ctx context.Context, enterpriseID uint64, action string, quantity int64) (*ChargeCost, error)
	// Reserve 预扣冻结（额度 + 点数），双账本 FOR UPDATE 锁定。
	Reserve(ctx context.Context, cmd ReserveCommand) (reservationID string, err error)
	// Settle 成功扣减（预留转已用）。
	Settle(ctx context.Context, reservationID string) error
	// Rollback 失败回滚（解冻归还）。
	Rollback(ctx context.Context, reservationID string) error
}

// ChargeCost is the estimated cost of a billing action (见设计文档 §8.1)。
type ChargeCost struct {
	Action      string
	Quantity    int64
	PointsCost  int64  // 点数成本（毫点）
	QuotaMetric string // 额度指标
	QuotaCost   int64  // 额度成本
	ChargeType  string // both / quota_only / points_only
	Sufficient  bool   // 余额是否充足
	Reason      string // 不充足时的原因
}

// ReserveCommand carries the parameters for a billing reservation (见设计文档 §8.1)。
type ReserveCommand struct {
	EnterpriseID   uint64
	Action         string // 计费项 key（如 article_generation / ai_distill）
	Quantity       int64
	ReferenceType  string // publish_task / geo_task / article_generation / keyword_distillation
	ReferenceID    uint64
	IdempotencyKey string
}

// PurchasablePlan is the user-facing plan projection for the pricing/purchase page.
type PurchasablePlan struct {
	ID                     uint64
	Code                   string
	Name                   string
	Description            string
	HalfYearlyPriceMinorUnits int64
	YearlyPriceMinorUnits     int64
	Currency               string
	BillingCycle           string
	SeriesCode             string
	GrantedPoints          int64
	Limits                 []*PlanLimitProjection
	Features               []*PlanFeatureProjection
	SortOrder              int32
}

// PlanLimitProjection is a read-side plan limit for the user-facing plan display.
type PlanLimitProjection struct {
	Metric     int32
	LimitValue int64
	Period     int32
}

// PlanFeatureProjection is a read-side plan feature for the user-facing plan display.
type PlanFeatureProjection struct {
	Feature int32
	Enabled bool
}

// PurchasablePlanRepo reads plans visible to enterprises (见设计文档 §11.2.2)。
type PurchasablePlanRepo interface {
	ListPurchasable(context.Context) ([]*PurchasablePlan, error)
}

// UserSubscriptionOrder is the user-facing order DO for self-purchase/recharge.
type UserSubscriptionOrder struct {
	ID               uint64
	OrderNo          string
	EnterpriseID     uint64
	PlanID           *uint64
	PlanName         string
	OrderType        string
	Cycle            string
	AmountMinorUnits int64
	Currency         string
	CreditsAmount    *int64
	Status           string
	Source           string
	Remark           string
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

// UserOrderListOptions filters the current enterprise's orders.
type UserOrderListOptions struct {
	EnterpriseID uint64
	OrderType    string
	Offset, Limit int
}

// UserSubscriptionOrderRepo manages the current enterprise's orders (user-side)。
type UserSubscriptionOrderRepo interface {
	Create(context.Context, *UserSubscriptionOrder) (*UserSubscriptionOrder, error)
	List(context.Context, UserOrderListOptions) ([]*UserSubscriptionOrder, int64, error)
	Get(context.Context, uint64, uint64) (*UserSubscriptionOrder, error) // enterpriseID, orderID
}

// UserPointsBalance is the user-facing points wallet DO (milli-points)。
type UserPointsBalance struct {
	EnterpriseID uint64
	Balance      int64
	Frozen       int64
}

// UserPointsBalanceRepo reads the current enterprise's points balance。
type UserPointsBalanceRepo interface {
	Get(context.Context, uint64) (*UserPointsBalance, error)
}
