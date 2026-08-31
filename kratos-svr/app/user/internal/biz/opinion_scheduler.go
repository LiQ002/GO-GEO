package biz

import (
	"context"
	"log/slog"
	"time"
)

// OpinionScheduler periodically generates LLM opinion summaries for finished
// periods that have no summary rows yet. Modelled after GeoScheduler: scan →
// generate → idempotent upsert (unique key guards against duplicates).
type OpinionScheduler struct {
	repo   GeoBrandBoardRepo
	logger *slog.Logger
}

// NewOpinionScheduler constructs the scheduler. Registered via wire ProviderSet.
func NewOpinionScheduler(r GeoBrandBoardRepo, logger *slog.Logger) *OpinionScheduler {
	return &OpinionScheduler{repo: r, logger: logger}
}

// Start runs the scheduler loop until ctx is cancelled.
func (s *OpinionScheduler) Start(ctx context.Context) {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	s.logger.Info("opinion summary scheduler started", slog.String("interval", "1h"))
	s.tick(ctx)
	for {
		select {
		case <-ctx.Done():
			s.logger.Info("opinion summary scheduler stopped")
			return
		case <-ticker.C:
			s.tick(ctx)
		}
	}
}

// tick 扫描有回答数据的 (企业, 品牌)，为本周/本月补生成舆情总结。
func (s *OpinionScheduler) tick(ctx context.Context) {
	targets, err := s.repo.ListBrandsWithAnswers(ctx)
	if err != nil {
		s.logger.Warn("opinion scheduler list targets", slog.Any("error", err))
		return
	}
	if len(targets) == 0 {
		return
	}
	now := time.Now()
	for _, t := range targets {
		for _, period := range []string{"week", "month"} {
			if err := s.repo.GenerateOpinionSummary(ctx, t.EnterpriseID, t.BrandID, period, now); err != nil {
				s.logger.Warn("opinion scheduler generate",
					slog.Uint64("enterprise_id", t.EnterpriseID),
					slog.Uint64("brand_id", t.BrandID),
					slog.String("period", period),
					slog.Any("error", err),
				)
			}
		}
	}
}
