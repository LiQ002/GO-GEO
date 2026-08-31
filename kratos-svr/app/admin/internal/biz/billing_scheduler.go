package biz

import (
	"context"
	"log/slog"
	"time"
)

// BillingSchedulerRepo provides batch scan/update operations for scheduled billing tasks.
type BillingSchedulerRepo interface {
	// ExpireOverdueSubscriptions 扫描 expires_at < now 且 status='active' 的订阅，置为 expired。
	// 返回处理的行数。
	ExpireOverdueSubscriptions(ctx context.Context, now time.Time) (int64, error)
	// ResetDueQuotaLimits 扫描 reset_at < now 的 quota_limits，重置 used_value=0、reserved_value=0，更新 reset_at。
	// 返回处理的行数。
	ResetDueQuotaLimits(ctx context.Context, now time.Time) (int64, error)
	// CancelTimeoutOrders 扫描 status='pending' 且创建时间超过阈值的订单，置为 cancelled。
	// 返回处理的行数。
	CancelTimeoutOrders(ctx context.Context, now time.Time, timeout time.Duration) (int64, error)
}

// BillingScheduler 定时处理订阅到期、配额重置、订单超时取消（见设计文档 §15）。
// 自动续费预留：当 auto_renew=true 的订阅即将到期时，可在此处创建续费订单。
type BillingScheduler struct {
	repo   BillingSchedulerRepo
	logger *slog.Logger
}

func NewBillingScheduler(repo BillingSchedulerRepo, logger *slog.Logger) *BillingScheduler {
	return &BillingScheduler{repo: repo, logger: logger}
}

// Start runs the scheduler loop until ctx is cancelled. Should be called as a goroutine.
func (s *BillingScheduler) Start(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	s.logger.Info("billing scheduler started", slog.String("interval", "5m"))
	s.tick(ctx)
	for {
		select {
		case <-ctx.Done():
			s.logger.Info("billing scheduler stopped")
			return
		case <-ticker.C:
			s.tick(ctx)
		}
	}
}

func (s *BillingScheduler) tick(ctx context.Context) {
	now := time.Now().UTC()

	// 1. 订阅到期处理
	if n, err := s.repo.ExpireOverdueSubscriptions(ctx, now); err != nil {
		s.logger.Warn("billing scheduler: expire overdue subscriptions", slog.Any("error", err))
	} else if n > 0 {
		s.logger.Info("billing scheduler: expired subscriptions", slog.Int64("count", n))
	}

	// 2. 配额周期重置
	if n, err := s.repo.ResetDueQuotaLimits(ctx, now); err != nil {
		s.logger.Warn("billing scheduler: reset due quota limits", slog.Any("error", err))
	} else if n > 0 {
		s.logger.Info("billing scheduler: reset quota limits", slog.Int64("count", n))
	}

	// 3. 订单超时取消（pending 超过 24 小时）
	if n, err := s.repo.CancelTimeoutOrders(ctx, now, 24*time.Hour); err != nil {
		s.logger.Warn("billing scheduler: cancel timeout orders", slog.Any("error", err))
	} else if n > 0 {
		s.logger.Info("billing scheduler: cancelled timeout orders", slog.Int64("count", n))
	}

	// 4. 自动续费（预留）：扫描 auto_renew=true 且即将到期（7天内）的订阅，
	//    创建 renew 订单。当前暂不实现，后续接入支付通道后启用。
}
