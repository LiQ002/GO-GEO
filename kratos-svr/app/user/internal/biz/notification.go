package biz

import (
	"context"
	"strings"
	"time"

	"github.com/go-kratos/kratos/v3/errors"
)

var (
	ErrNotificationNotFound = errors.NotFound("NOTIFICATION_NOT_FOUND", "notification not found")
	ErrNotificationInvalid  = errors.BadRequest("NOTIFICATION_INVALID", "invalid notification request")
)

const EnterpriseAccountRecipient = "enterprise_account"

type Notification struct {
	ID             uint64
	EnterpriseID   uint64
	RecipientID    uint64
	Channel        string
	TemplateCode   string
	PayloadJSON    string
	DeliveryStatus string
	ScheduledAt    time.Time
	SentAt         *time.Time
	ReadAt         *time.Time
	CreatedAt      time.Time
}

type NotificationListOptions struct {
	Offset     int
	Limit      int
	UnreadOnly bool
	Channel    string
}

type NotificationRepo interface {
	Get(context.Context, uint64, uint64, uint64) (*Notification, error)
	List(context.Context, uint64, uint64, NotificationListOptions) ([]*Notification, int64, error)
	UnreadCount(context.Context, uint64, uint64) (int64, error)
	MarkRead(context.Context, uint64, uint64, uint64) (*Notification, error)
	MarkAllRead(context.Context, uint64, uint64) (int64, error)
}

type NotificationUsecase struct {
	repo NotificationRepo
}

func NewNotificationUsecase(repo NotificationRepo) *NotificationUsecase {
	return &NotificationUsecase{repo: repo}
}

func (u *NotificationUsecase) Get(ctx context.Context, enterpriseID, accountID, id uint64) (*Notification, error) {
	if enterpriseID == 0 || accountID == 0 || id == 0 {
		return nil, ErrNotificationInvalid
	}
	return u.repo.Get(ctx, enterpriseID, accountID, id)
}

func (u *NotificationUsecase) List(ctx context.Context, enterpriseID, accountID uint64, opts NotificationListOptions) ([]*Notification, int64, error) {
	if enterpriseID == 0 || accountID == 0 || opts.Offset < 0 || opts.Limit <= 0 {
		return nil, 0, ErrNotificationInvalid
	}
	opts.Channel = strings.TrimSpace(opts.Channel)
	return u.repo.List(ctx, enterpriseID, accountID, opts)
}

func (u *NotificationUsecase) UnreadCount(ctx context.Context, enterpriseID, accountID uint64) (int64, error) {
	if enterpriseID == 0 || accountID == 0 {
		return 0, ErrNotificationInvalid
	}
	return u.repo.UnreadCount(ctx, enterpriseID, accountID)
}

func (u *NotificationUsecase) MarkRead(ctx context.Context, enterpriseID, accountID, id uint64) (*Notification, error) {
	if enterpriseID == 0 || accountID == 0 || id == 0 {
		return nil, ErrNotificationInvalid
	}
	return u.repo.MarkRead(ctx, enterpriseID, accountID, id)
}

func (u *NotificationUsecase) MarkAllRead(ctx context.Context, enterpriseID, accountID uint64) (int64, error) {
	if enterpriseID == 0 || accountID == 0 {
		return 0, ErrNotificationInvalid
	}
	return u.repo.MarkAllRead(ctx, enterpriseID, accountID)
}
