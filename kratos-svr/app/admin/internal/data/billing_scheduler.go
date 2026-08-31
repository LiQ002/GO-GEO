package data

import (
	"context"
	"time"

	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/data/model"
)

// billingSchedulerRepo implements biz.BillingSchedulerRepo using GORM batch updates.
type billingSchedulerRepo struct {
	data *Data
}

func NewBillingSchedulerRepo(data *Data) biz.BillingSchedulerRepo {
	return &billingSchedulerRepo{data: data}
}

// ExpireOverdueSubscriptions 标记过期订阅：expires_at < now 且仍为 active 的订阅置为 expired。
// 使用 expired_at_processed 作为幂等标志，避免重复处理。
// 同时清零过期企业的套餐额度（used_value/reserved_value → 0），点数余额保留不动。
func (r *billingSchedulerRepo) ExpireOverdueSubscriptions(ctx context.Context, now time.Time) (int64, error) {
	// 先查出即将过期的订阅对应的企业 ID（用于清零额度）
	var expiringSubs []model.Subscription
	if err := r.data.DB(ctx).
		Select("enterprise_id").
		Where("status = ? AND expires_at < ? AND expired_at_processed = ?", "active", now, false).
		Find(&expiringSubs).Error; err != nil {
		return 0, err
	}
	if len(expiringSubs) == 0 {
		return 0, nil
	}

	enterpriseIDs := make([]uint64, 0, len(expiringSubs))
	for _, s := range expiringSubs {
		enterpriseIDs = append(enterpriseIDs, s.EnterpriseID)
	}

	// 标记订阅为已过期
	res := r.data.DB(ctx).Model(&model.Subscription{}).
		Where("status = ? AND expires_at < ? AND expired_at_processed = ?", "active", now, false).
		Updates(map[string]any{
			"status":               "expired",
			"expired_at_processed": true,
			"updated_at":           now,
		})
	if res.Error != nil {
		return 0, res.Error
	}

	// 清零过期企业的套餐额度（used_value → 0, reserved_value → 0）
	// 点数余额（ent_points_balances）不动，永久保留
	if err := r.data.DB(ctx).Model(&model.QuotaLimit{}).
		Where("enterprise_id IN ?", enterpriseIDs).
		Updates(map[string]any{
			"used_value":     0,
			"reserved_value": 0,
			"updated_at":     now,
		}).Error; err != nil {
		return res.RowsAffected, err
	}

	return res.RowsAffected, nil
}

// ResetDueQuotaLimits 重置到期配额：reset_at < now 的 quota_limits 重置 used/reserved 并推进下一周期。
// 仅处理 daily/monthly/yearly 周期；total/lifetime 不重置。
// 为避免长事务锁定过多行，分批处理（每批 500 条）。
func (r *billingSchedulerRepo) ResetDueQuotaLimits(ctx context.Context, now time.Time) (int64, error) {
	var total int64
	const batchSize = 500
	for {
		var batch []model.QuotaLimit
		err := r.data.DB(ctx).
			Where("period IN ? AND (reset_at IS NULL OR reset_at < ?)",
				[]string{"daily", "monthly", "yearly"}, now).
			Order("id ASC").
			Limit(batchSize).
			Find(&batch).Error
		if err != nil {
			return total, err
		}
		if len(batch) == 0 {
			return total, nil
		}
		for _, q := range batch {
			nextReset := computeNextResetAt(q.Period, now)
			if err := r.data.DB(ctx).Model(&model.QuotaLimit{}).
				Where("id = ? AND (reset_at IS NULL OR reset_at < ?)", q.ID, now).
				Updates(map[string]any{
					"used_value":     0,
					"reserved_value": 0,
					"reset_at":       nextReset,
					"updated_at":     now,
				}).Error; err != nil {
				return total, err
			}
			total++
		}
		if int64(len(batch)) < batchSize {
			return total, nil
		}
	}
}

// CancelTimeoutOrders 取消超时未确认订单：status='pending' 且 created_at < now-timeout。
func (r *billingSchedulerRepo) CancelTimeoutOrders(ctx context.Context, now time.Time, timeout time.Duration) (int64, error) {
	deadline := now.Add(-timeout)
	res := r.data.DB(ctx).Model(&model.SubscriptionOrder{}).
		Where("status = ? AND created_at < ?", "pending", deadline).
		Updates(map[string]any{
			"status":     "cancelled",
			"updated_at": now,
		})
	if res.Error != nil {
		return 0, res.Error
	}
	return res.RowsAffected, nil
}

// computeNextResetAt 根据周期类型计算下一次重置时间。
// daily: 次日 00:00 UTC；monthly: 下月同日 00:00 UTC；yearly: 次年同日 00:00 UTC。
func computeNextResetAt(period string, from time.Time) *time.Time {
	switch period {
	case "daily":
		t := from.AddDate(0, 0, 1).UTC().Truncate(24 * time.Hour)
		return &t
	case "monthly":
		t := from.AddDate(0, 1, 0).UTC().Truncate(24 * time.Hour)
		return &t
	case "yearly":
		t := from.AddDate(1, 0, 0).UTC().Truncate(24 * time.Hour)
		return &t
	default:
		return nil
	}
}

var _ biz.BillingSchedulerRepo = (*billingSchedulerRepo)(nil)
