package model

import "time"

// Agent reserves the future reseller boundary without granting access today.
type Agent struct {
	SoftDeleteModel
	Code          string `gorm:"column:code;type:varchar(64);not null;uniqueIndex"`
	Name          string `gorm:"column:name;type:varchar(128);not null"`
	Status        string `gorm:"column:status;type:varchar(32);not null"`
	ContactName   string `gorm:"column:contact_name;type:varchar(128)"`
	ContactPhone  string `gorm:"column:contact_phone;type:varchar(64)"`
	SettlementRef string `gorm:"column:settlement_ref;type:varchar(128)"`
}

func (Agent) TableName() string { return TableAgents }

// Enterprise is the tenant root.
type Enterprise struct {
	SoftDeleteModel
	AgentID          *uint64 `gorm:"column:agent_id;index"`
	Code             string  `gorm:"column:code;type:varchar(64);not null;uniqueIndex"`
	Name             string  `gorm:"column:name;type:varchar(128);not null;index"`
	Status           string  `gorm:"column:status;type:varchar(32);not null;index"`
	Industry         string  `gorm:"column:industry;type:varchar(128)"`
	Region           string  `gorm:"column:region;type:varchar(128)"`
	Timezone         string  `gorm:"column:timezone;type:varchar(64);not null;default:'Asia/Shanghai'"`
	Locale           string  `gorm:"column:locale;type:varchar(32);not null;default:'zh-CN'"`
	ContactName      string  `gorm:"column:contact_name;type:varchar(128)"`
	ContactEmail     string  `gorm:"column:contact_email;type:varchar(255)"`
	ContactPhone     string  `gorm:"column:contact_phone;type:varchar(64)"`
	NotificationJSON []byte  `gorm:"column:notification_json;type:json"`
	Remark           string  `gorm:"column:remark;type:text"`
	Version          uint64  `gorm:"column:version;not null;default:1"`
}

func (Enterprise) TableName() string { return TableEnterprises }

// EnterpriseAccount is the single full-access enterprise login account.
type EnterpriseAccount struct {
	SoftDeleteModel
	EnterpriseID       uint64     `gorm:"column:enterprise_id;not null;uniqueIndex"`
	Username           string     `gorm:"column:username;type:varchar(64);not null;uniqueIndex"`
	Email              string     `gorm:"column:email;type:varchar(255);index"`
	Phone              string     `gorm:"column:phone;type:varchar(64);index"`
	PasswordHash       string     `gorm:"column:password_hash;type:varchar(255);not null"`
	Status             string     `gorm:"column:status;type:varchar(32);not null;index"`
	MustChangePassword bool       `gorm:"column:must_change_password;not null;default:false"`
	FailedLoginCount   uint32     `gorm:"column:failed_login_count;not null;default:0"`
	LockedUntil        *time.Time `gorm:"column:locked_until"`
	LastLoginAt        *time.Time `gorm:"column:last_login_at"`
}

func (EnterpriseAccount) TableName() string { return TableEnterpriseAccounts }

// Plan defines commercial limits.
type Plan struct {
	SoftDeleteModel
	Code                   string `gorm:"column:code;type:varchar(64);not null;uniqueIndex"`
	Name                   string `gorm:"column:name;type:varchar(128);not null"`
	Description            string `gorm:"column:description;type:varchar(1024)"`
	Status                 int32  `gorm:"column:status;type:tinyint unsigned;not null"`
	HalfYearlyPriceMinorUnits int64  `gorm:"column:half_yearly_price_minor_units;not null;default:0"`
	YearlyPriceMinorUnits  int64  `gorm:"column:yearly_price_minor_units;not null;default:0"`
	Currency               string `gorm:"column:currency;type:char(3);not null;default:'CNY'"`
	BillingCycle           string `gorm:"column:billing_cycle;type:varchar(32);not null;default:'yearly'"`
	VisibleToEnterprise    bool   `gorm:"column:visible_to_enterprise;not null;default:true"`
	SortOrder              int32  `gorm:"column:sort_order;not null;default:0"`
	SeriesCode             string `gorm:"column:series_code;type:varchar(64);not null;default:''"`
	GrantedPoints          int64  `gorm:"column:granted_points;not null;default:0"`
}

func (Plan) TableName() string { return TablePlans }

// PlanLimit defines one measurable quota included in a plan.
type PlanLimit struct {
	BaseModel
	PlanID     uint64 `gorm:"column:plan_id;not null;uniqueIndex:uk_ent_plan_limit,priority:1;index"`
	Metric     int32  `gorm:"column:metric;type:tinyint unsigned;not null;uniqueIndex:uk_ent_plan_limit,priority:2"`
	LimitValue int64  `gorm:"column:limit_value;not null"`
	Period     int32  `gorm:"column:period;type:tinyint unsigned;not null"`
}

func (PlanLimit) TableName() string { return TablePlanLimits }

// PlanFeature defines one product capability included in a plan.
type PlanFeature struct {
	BaseModel
	PlanID  uint64 `gorm:"column:plan_id;not null;uniqueIndex:uk_ent_plan_feature,priority:1;index"`
	Feature int32  `gorm:"column:feature;type:tinyint unsigned;not null;uniqueIndex:uk_ent_plan_feature,priority:2"`
	Enabled bool   `gorm:"column:enabled;not null;default:true"`
}

func (PlanFeature) TableName() string { return TablePlanFeatures }

// Subscription assigns a plan and validity period to an enterprise.
type Subscription struct {
	TenantModel
	PlanID             uint64    `gorm:"column:plan_id;not null;index"`
	ActivatedOrderID   *uint64   `gorm:"column:activated_order_id"`
	Status             string    `gorm:"column:status;type:varchar(32);not null;index"`
	StartsAt           time.Time `gorm:"column:starts_at;not null"`
	ExpiresAt          time.Time `gorm:"column:expires_at;not null;index"`
	AutoRenew          bool      `gorm:"column:auto_renew;not null;default:false"`
	ExpiredAtProcessed bool      `gorm:"column:expired_at_processed;not null;default:false"`
	Version            uint64    `gorm:"column:version;not null;default:1"`
}

func (Subscription) TableName() string { return TableSubscriptions }

// QuotaLimit stores a single measurable enterprise limit.
type QuotaLimit struct {
	TenantModel
	Metric        string     `gorm:"column:metric;type:varchar(64);not null;uniqueIndex:uk_ent_quota,priority:2"`
	LimitValue    int64      `gorm:"column:limit_value;not null"`
	UsedValue     int64      `gorm:"column:used_value;not null;default:0"`
	ReservedValue int64      `gorm:"column:reserved_value;not null;default:0"`
	Period        string     `gorm:"column:period;type:varchar(32);not null"`
	ResetAt       *time.Time `gorm:"column:reset_at"`
}

func (QuotaLimit) TableName() string { return TableQuotaLimits }

// UsageLedger is an append-only quota reservation/settlement record.
type UsageLedger struct {
	ImmutableTenantModel
	Metric         string `gorm:"column:metric;type:varchar(64);not null;index"`
	Operation      string `gorm:"column:operation;type:varchar(32);not null"`
	Amount         int64  `gorm:"column:amount;not null"`
	BalanceAfter   int64  `gorm:"column:balance_after;not null"`
	ReferenceType  string `gorm:"column:reference_type;type:varchar(64);not null"`
	ReferenceID    uint64 `gorm:"column:reference_id;not null;index"`
	IdempotencyKey string `gorm:"column:idempotency_key;type:varchar(128);not null;uniqueIndex"`
	Reason         string `gorm:"column:reason;type:varchar(512)"`
}

func (UsageLedger) TableName() string { return TableUsageLedgers }

// SubscriptionOrder is the unified order record for plan/renew/addon/credits/refund.
type SubscriptionOrder struct {
	TenantModel
	OrderNo                 string     `gorm:"column:order_no;type:varchar(64);not null;uniqueIndex"`
	PlanID                  *uint64    `gorm:"column:plan_id"`
	OrderType               string     `gorm:"column:order_type;type:varchar(32);not null"`
	Cycle                   string     `gorm:"column:cycle;type:varchar(32)"`
	AmountMinorUnits        int64      `gorm:"column:amount_minor_units;not null;default:0"`
	Currency                string     `gorm:"column:currency;type:char(3);not null;default:'CNY'"`
	CreditsAmount           *int64     `gorm:"column:credits_amount"`
	AddonQuotaMetric        string     `gorm:"column:addon_quota_metric;type:varchar(64)"`
	AddonQuotaAmount        *int64     `gorm:"column:addon_quota_amount"`
	RenewFromSubscriptionID *uint64    `gorm:"column:renew_from_subscription_id"`
	RefundReferenceOrderID  *uint64    `gorm:"column:refund_reference_order_id"`
	PointsBefore            *int64     `gorm:"column:points_before"`
	PointsAfter             *int64     `gorm:"column:points_after"`
	Status                  string     `gorm:"column:status;type:varchar(32);not null"`
	Source                  string     `gorm:"column:source;type:varchar(32);not null"`
	PaidAt                  *time.Time `gorm:"column:paid_at"`
	ApprovedAt              *time.Time `gorm:"column:approved_at"`
	ApprovedBy              *uint64    `gorm:"column:approved_by"`
	Remark                  string     `gorm:"column:remark;type:text"`
}

func (SubscriptionOrder) TableName() string { return TableSubscriptionOrders }

// PointsBalance is the per-enterprise points wallet (milli-points).
type PointsBalance struct {
	ID           uint64    `gorm:"column:id;primaryKey;autoIncrement"`
	EnterpriseID uint64    `gorm:"column:enterprise_id;not null;uniqueIndex"`
	Balance      int64     `gorm:"column:balance;not null;default:0"`
	Frozen       int64     `gorm:"column:frozen;not null;default:0"`
	Version      uint64    `gorm:"column:version;not null;default:1"`
	CreatedAt    time.Time `gorm:"column:created_at;not null"`
	UpdatedAt    time.Time `gorm:"column:updated_at;not null"`
}

func (PointsBalance) TableName() string { return TablePointsBalances }

// PointsLedger is an append-only points adjustment record.
type PointsLedger struct {
	ImmutableTenantModel
	Operation      string  `gorm:"column:operation;type:varchar(32);not null"`
	Amount         int64   `gorm:"column:amount;not null"`
	BalanceAfter   int64   `gorm:"column:balance_after;not null"`
	FrozenAfter    int64   `gorm:"column:frozen_after;not null"`
	ReferenceType  string  `gorm:"column:reference_type;type:varchar(64)"`
	ReferenceID    *uint64 `gorm:"column:reference_id"`
	Reason         string  `gorm:"column:reason;type:varchar(256)"`
	OperatorID     *uint64 `gorm:"column:operator_id"`
	IdempotencyKey string  `gorm:"column:idempotency_key;type:varchar(128);uniqueIndex"`
}

func (PointsLedger) TableName() string { return TablePointsLedgers }

// EnterpriseAgentHistory records changes to the reserved agent ownership.
type EnterpriseAgentHistory struct {
	BaseModel
	EnterpriseID uint64  `gorm:"column:enterprise_id;not null;index"`
	OldAgentID   *uint64 `gorm:"column:old_agent_id"`
	NewAgentID   *uint64 `gorm:"column:new_agent_id"`
	OperatorID   uint64  `gorm:"column:operator_id;not null"`
	Reason       string  `gorm:"column:reason;type:varchar(512);not null"`
}

func (EnterpriseAgentHistory) TableName() string { return TableEnterpriseAgentHistories }
