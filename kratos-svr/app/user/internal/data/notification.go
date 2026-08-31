package data

import (
	"context"
	"errors"
	"time"

	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/data/model"

	"gorm.io/gorm"
)

type notificationRepo struct {
	data *Data
}

func NewNotificationRepo(data *Data) biz.NotificationRepo {
	return &notificationRepo{data: data}
}

func (r *notificationRepo) Get(ctx context.Context, enterpriseID, accountID, id uint64) (*biz.Notification, error) {
	var record model.Notification
	if err := notificationScope(r.data.DB(ctx), enterpriseID, accountID).
		Where("id = ?", id).First(&record).Error; err != nil {
		return nil, mapNotificationError(err)
	}
	return notificationDO(&record), nil
}

func (r *notificationRepo) List(ctx context.Context, enterpriseID, accountID uint64, opts biz.NotificationListOptions) ([]*biz.Notification, int64, error) {
	db := notificationScope(r.data.DB(ctx).Model(&model.Notification{}), enterpriseID, accountID)
	if opts.UnreadOnly {
		db = db.Where("read_at IS NULL")
	}
	if opts.Channel != "" {
		db = db.Where("channel = ?", opts.Channel)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var records []model.Notification
	if err := db.Order("created_at DESC, id DESC").Offset(opts.Offset).Limit(opts.Limit).Find(&records).Error; err != nil {
		return nil, 0, err
	}
	items := make([]*biz.Notification, 0, len(records))
	for i := range records {
		items = append(items, notificationDO(&records[i]))
	}
	return items, total, nil
}

func (r *notificationRepo) UnreadCount(ctx context.Context, enterpriseID, accountID uint64) (int64, error) {
	var total int64
	err := notificationScope(r.data.DB(ctx).Model(&model.Notification{}), enterpriseID, accountID).
		Where("read_at IS NULL").Count(&total).Error
	return total, err
}

func (r *notificationRepo) MarkRead(ctx context.Context, enterpriseID, accountID, id uint64) (*biz.Notification, error) {
	now := time.Now().UTC()
	result := notificationScope(r.data.DB(ctx).Model(&model.Notification{}), enterpriseID, accountID).
		Where("id = ? AND read_at IS NULL", id).Update("read_at", now)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		// Marking an already-read notification is deliberately idempotent, while
		// a missing or foreign-tenant notification remains indistinguishable.
		return r.Get(ctx, enterpriseID, accountID, id)
	}
	return r.Get(ctx, enterpriseID, accountID, id)
}

func (r *notificationRepo) MarkAllRead(ctx context.Context, enterpriseID, accountID uint64) (int64, error) {
	now := time.Now().UTC()
	result := notificationScope(r.data.DB(ctx).Model(&model.Notification{}), enterpriseID, accountID).
		Where("read_at IS NULL").Update("read_at", now)
	return result.RowsAffected, result.Error
}

func notificationScope(db *gorm.DB, enterpriseID, accountID uint64) *gorm.DB {
	return db.Where("enterprise_id = ? AND recipient_type = ? AND recipient_id = ?", enterpriseID, biz.EnterpriseAccountRecipient, accountID)
}

func notificationDO(record *model.Notification) *biz.Notification {
	if record == nil {
		return nil
	}
	enterpriseID := uint64(0)
	if record.EnterpriseID != nil {
		enterpriseID = *record.EnterpriseID
	}
	return &biz.Notification{
		ID: record.ID, EnterpriseID: enterpriseID, RecipientID: record.RecipientID,
		Channel: record.Channel, TemplateCode: record.TemplateCode,
		PayloadJSON: string(record.PayloadJSON), DeliveryStatus: record.Status,
		ScheduledAt: record.ScheduledAt, SentAt: record.SentAt, ReadAt: record.ReadAt,
		CreatedAt: record.CreatedAt,
	}
}

func mapNotificationError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return biz.ErrNotificationNotFound
	}
	return err
}
