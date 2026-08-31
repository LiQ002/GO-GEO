package biz

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"kratos-svr/internal/security"

	"github.com/go-kratos/kratos/v3/errors"
)

var (
	ErrEnterpriseNotFound            = errors.NotFound("ENTERPRISE_NOT_FOUND", "enterprise not found")
	ErrEnterpriseInvalid             = errors.BadRequest("ENTERPRISE_INVALID", "invalid enterprise data")
	ErrEnterpriseCodeRequired        = errors.BadRequest("ENTERPRISE_CODE_REQUIRED", "enterprise code is required")
	ErrEnterpriseNameRequired        = errors.BadRequest("ENTERPRISE_NAME_REQUIRED", "enterprise name is required")
	ErrEnterpriseUsernameRequired    = errors.BadRequest("ENTERPRISE_USERNAME_REQUIRED", "enterprise username is required")
	ErrEnterprisePasswordInvalid     = errors.BadRequest("ENTERPRISE_PASSWORD_INVALID", "enterprise password must contain at least 10 characters, including letters and digits")
	ErrEnterpriseNotificationInvalid = errors.BadRequest("ENTERPRISE_NOTIFICATION_INVALID", "enterprise notification JSON is invalid")
	ErrEnterpriseQuotaInvalid        = errors.BadRequest("ENTERPRISE_QUOTA_INVALID", "enterprise quota is invalid")
	ErrEnterpriseSubscriptionInvalid = errors.BadRequest("ENTERPRISE_SUBSCRIPTION_INVALID", "enterprise subscription requires a plan and expiration time")
	ErrEnterpriseConflict            = errors.Conflict("ENTERPRISE_CONFLICT", "enterprise data has changed")
)

type Enterprise struct {
	ID               uint64
	AgentID          *uint64
	Code             string
	Name             string
	Status           string
	Industry         string
	Region           string
	Timezone         string
	Locale           string
	ContactName      string
	ContactEmail     string
	ContactPhone     string
	NotificationJSON string
	Remark           string
	Version          uint64
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

type EnterpriseAccount struct {
	ID                 uint64
	EnterpriseID       uint64
	Username           string
	Email              string
	Phone              string
	PasswordHash       string
	Status             string
	MustChangePassword bool
	FailedLoginCount   uint32
	LockedUntil        *time.Time
	LastLoginAt        *time.Time
}

type Subscription struct {
	ID                 uint64
	EnterpriseID       uint64
	PlanID             uint64
	ActivatedOrderID   *uint64
	PlanName           string
	Status             string
	StartsAt           time.Time
	ExpiresAt          time.Time
	AutoRenew          bool
	ExpiredAtProcessed bool
	Version            uint64
}

type QuotaLimit struct {
	ID            uint64
	EnterpriseID  uint64
	Metric        string
	LimitValue    int64
	UsedValue     int64
	ReservedValue int64
	Period        string
	ResetAt       *time.Time
}

type EnterpriseDetail struct {
	Enterprise     *Enterprise
	Account        *EnterpriseAccount
	Subscription   *Subscription
	Quotas         []*QuotaLimit
	ArticleCount   int64
	PublishedCount int64
	PointsBalance  int64 // 点数余额（毫点）
	PointsFrozen   int64 // 点数冻结（毫点）
}

type CreateEnterpriseCommand struct {
	Detail              *EnterpriseDetail
	InitialPassword     string
	SubscriptionExpires time.Time
	GrantedPoints       int64 // 额外赠送点数（毫点）；套餐自带点数会自动发放
	OperatorID          uint64
}

type EnterpriseListOptions struct {
	Offset       int
	Limit        int
	Keyword      string
	Status       string
	PlanID       uint64
	AgentID      *uint64
	ExpiringSoon *bool
}

type EnterpriseStatusCommand struct {
	ID, Version, OperatorID uint64
	Action, Reason          string
}

type EnterprisePasswordCommand struct {
	ID, OperatorID uint64
	PasswordHash   string
	Reason         string
}

type SubscriptionCommand struct {
	Subscription    *Subscription
	ExpectedVersion uint64
	OperatorID      uint64
	Reason          string
}

type QuotaCommand struct {
	Quota      *QuotaLimit
	OperatorID uint64
	Reason     string
}

type EnterpriseRepo interface {
	Create(context.Context, CreateEnterpriseCommand) (*EnterpriseDetail, error)
	Get(context.Context, uint64) (*EnterpriseDetail, error)
	List(context.Context, EnterpriseListOptions) ([]*EnterpriseDetail, int64, error)
	Update(context.Context, *Enterprise, uint64) (*EnterpriseDetail, error)
	ChangeStatus(context.Context, EnterpriseStatusCommand) (*EnterpriseDetail, error)
	ResetPassword(context.Context, EnterprisePasswordCommand) (*EnterpriseAccount, error)
	SetSubscription(context.Context, SubscriptionCommand) (*Subscription, error)
	SetQuota(context.Context, QuotaCommand) (*QuotaLimit, error)
}

type EnterpriseUsecase struct{ repo EnterpriseRepo }

func NewEnterpriseUsecase(repo EnterpriseRepo) *EnterpriseUsecase {
	return &EnterpriseUsecase{repo: repo}
}

func (uc *EnterpriseUsecase) Create(ctx context.Context, cmd CreateEnterpriseCommand) (*EnterpriseDetail, error) {
	if cmd.Detail == nil || cmd.Detail.Enterprise == nil || cmd.Detail.Account == nil {
		return nil, ErrEnterpriseInvalid
	}
	if cmd.OperatorID == 0 {
		return nil, ErrAdminSession
	}
	enterprise := cmd.Detail.Enterprise
	account := cmd.Detail.Account
	if strings.TrimSpace(enterprise.Code) == "" {
		return nil, ErrEnterpriseCodeRequired
	}
	if strings.TrimSpace(enterprise.Name) == "" {
		return nil, ErrEnterpriseNameRequired
	}
	if strings.TrimSpace(account.Username) == "" {
		return nil, ErrEnterpriseUsernameRequired
	}
	if err := security.ValidatePassword(cmd.InitialPassword); err != nil {
		return nil, ErrEnterprisePasswordInvalid
	}
	if enterprise.NotificationJSON != "" && !json.Valid([]byte(enterprise.NotificationJSON)) {
		return nil, ErrEnterpriseNotificationInvalid
	}
	hash, err := security.HashPassword(cmd.InitialPassword)
	if err != nil {
		return nil, ErrEnterpriseInvalid
	}
	enterprise.Code = strings.TrimSpace(enterprise.Code)
	enterprise.Name = strings.TrimSpace(enterprise.Name)
	enterprise.Status = "active"
	enterprise.Version = 1
	if enterprise.Timezone == "" {
		enterprise.Timezone = "Asia/Shanghai"
	}
	if enterprise.Locale == "" {
		enterprise.Locale = "zh-CN"
	}
	account.Username = strings.TrimSpace(account.Username)
	account.PasswordHash = hash
	account.Status = "active"
	account.MustChangePassword = true
	for _, quota := range cmd.Detail.Quotas {
		if quota == nil || strings.TrimSpace(quota.Metric) == "" || quota.LimitValue < 0 {
			return nil, ErrEnterpriseQuotaInvalid
		}
		if quota.Period == "" {
			quota.Period = "monthly"
		}
	}
	if cmd.Detail.Subscription != nil {
		if cmd.Detail.Subscription.PlanID == 0 || cmd.SubscriptionExpires.IsZero() {
			return nil, ErrEnterpriseSubscriptionInvalid
		}
		cmd.Detail.Subscription.Status = "active"
		cmd.Detail.Subscription.StartsAt = time.Now().UTC()
		cmd.Detail.Subscription.ExpiresAt = cmd.SubscriptionExpires
		cmd.Detail.Subscription.Version = 1
	}
	return uc.repo.Create(ctx, cmd)
}

func (uc *EnterpriseUsecase) Get(ctx context.Context, id uint64) (*EnterpriseDetail, error) {
	if id == 0 {
		return nil, ErrEnterpriseInvalid
	}
	return uc.repo.Get(ctx, id)
}

func (uc *EnterpriseUsecase) List(ctx context.Context, opts EnterpriseListOptions) ([]*EnterpriseDetail, int64, error) {
	return uc.repo.List(ctx, opts)
}

func (uc *EnterpriseUsecase) Update(ctx context.Context, item *Enterprise, operatorID uint64) (*EnterpriseDetail, error) {
	if item == nil || item.ID == 0 || item.Version == 0 || operatorID == 0 || strings.TrimSpace(item.Name) == "" {
		return nil, ErrEnterpriseInvalid
	}
	if item.NotificationJSON != "" && !json.Valid([]byte(item.NotificationJSON)) {
		return nil, ErrEnterpriseInvalid
	}
	return uc.repo.Update(ctx, item, operatorID)
}

func (uc *EnterpriseUsecase) ChangeStatus(ctx context.Context, cmd EnterpriseStatusCommand) (*EnterpriseDetail, error) {
	if cmd.ID == 0 || cmd.Version == 0 || cmd.OperatorID == 0 || strings.TrimSpace(cmd.Reason) == "" ||
		(cmd.Action != "activate" && cmd.Action != "suspend") {
		return nil, ErrEnterpriseInvalid
	}
	return uc.repo.ChangeStatus(ctx, cmd)
}

func (uc *EnterpriseUsecase) ResetPassword(ctx context.Context, cmd EnterprisePasswordCommand, password string) (*EnterpriseAccount, error) {
	if cmd.ID == 0 || cmd.OperatorID == 0 || strings.TrimSpace(cmd.Reason) == "" {
		return nil, ErrEnterpriseInvalid
	}
	if err := security.ValidatePassword(password); err != nil {
		return nil, ErrEnterprisePasswordInvalid
	}
	hash, err := security.HashPassword(password)
	if err != nil {
		return nil, ErrEnterpriseInvalid
	}
	cmd.PasswordHash = hash
	return uc.repo.ResetPassword(ctx, cmd)
}

func (uc *EnterpriseUsecase) SetSubscription(ctx context.Context, cmd SubscriptionCommand) (*Subscription, error) {
	item := cmd.Subscription
	if item == nil || item.EnterpriseID == 0 || item.PlanID == 0 || cmd.OperatorID == 0 ||
		item.StartsAt.IsZero() || !item.ExpiresAt.After(item.StartsAt) || strings.TrimSpace(cmd.Reason) == "" {
		return nil, ErrEnterpriseInvalid
	}
	if item.Status == "" {
		item.Status = "active"
	}
	return uc.repo.SetSubscription(ctx, cmd)
}

func (uc *EnterpriseUsecase) SetQuota(ctx context.Context, cmd QuotaCommand) (*QuotaLimit, error) {
	item := cmd.Quota
	if item == nil || item.EnterpriseID == 0 || strings.TrimSpace(item.Metric) == "" ||
		item.LimitValue < 0 || cmd.OperatorID == 0 || strings.TrimSpace(cmd.Reason) == "" {
		return nil, ErrEnterpriseInvalid
	}
	if item.Period == "" {
		item.Period = "monthly"
	}
	return uc.repo.SetQuota(ctx, cmd)
}
