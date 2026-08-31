package biz

import (
	"context"
	"errors"
	"log/slog"
	"strconv"
	"strings"
	"time"
)

// GeoScheduler scans geo_monitor_plans every minute and generates geo_tasks
// for plans whose next_run_at has arrived. Implements the design doc 6.4.3
// "周期调度机制": scan → quota check → generate tasks → update next_run_at.
type GeoScheduler struct {
	repo   GeoMonitorRepo
	logger *slog.Logger
}

// NewGeoScheduler creates the scheduler. Registered via wire ProviderSet.
func NewGeoScheduler(r GeoMonitorRepo, logger *slog.Logger) *GeoScheduler {
	return &GeoScheduler{repo: r, logger: logger}
}

// Start runs the scheduler loop until ctx is cancelled. Should be called
// as a goroutine from the application bootstrap.
func (s *GeoScheduler) Start(ctx context.Context) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	s.logger.Info("geo scheduler started", slog.String("interval", "1m"))
	// Run once immediately so a restart doesn't wait a full minute.
	s.tick(ctx)
	for {
		select {
		case <-ctx.Done():
			s.logger.Info("geo scheduler stopped")
			return
		case <-ticker.C:
			s.tick(ctx)
		}
	}
}

// tick scans for due plans and processes them one by one.
func (s *GeoScheduler) tick(ctx context.Context) {
	now := time.Now().UTC()
	plans, err := s.repo.ListDuePlans(ctx, now, 50)
	if err != nil {
		s.logger.Warn("geo scheduler list due plans", slog.Any("error", err))
		return
	}
	if len(plans) == 0 {
		return
	}
	for _, plan := range plans {
		s.processPlan(ctx, plan, now)
	}
}

// processPlan generates tasks for one due plan, then advances next_run_at.
// On quota exhaustion the plan is auto-paused per design doc 6.4.3.
func (s *GeoScheduler) processPlan(ctx context.Context, plan *MonitorPlan, now time.Time) {
	scheduledAt := now
	if plan.NextRunAt != nil && plan.NextRunAt.Before(now) {
		scheduledAt = *plan.NextRunAt
	}

	count, err := s.repo.GenerateTasksForPlan(ctx, plan, scheduledAt)
	if err != nil {
		if errors.Is(err, ErrGeoQuotaExceeded) || errors.Is(err, ErrPublishQuota) {
			s.logger.Warn("geo scheduler quota exhausted, pausing plan",
				slog.Uint64("plan_id", plan.ID),
				slog.Uint64("enterprise_id", plan.EnterpriseID),
			)
			if pauseErr := s.repo.PausePlanDueToQuota(ctx, plan.ID, plan.Version); pauseErr != nil {
				s.logger.Error("geo scheduler pause plan on quota",
					slog.Uint64("plan_id", plan.ID),
					slog.Any("error", pauseErr),
				)
			}
			return
		}
		s.logger.Error("geo scheduler generate tasks",
			slog.Uint64("plan_id", plan.ID),
			slog.Any("error", err),
		)
		return
	}

	lastRun := now
	nextRun := calcNextRun(plan, now)
	if e := s.repo.UpdatePlanSchedule(ctx, plan.ID, plan.Version, &lastRun, nextRun); e != nil {
		s.logger.Error("geo scheduler update plan schedule",
			slog.Uint64("plan_id", plan.ID),
			slog.Any("error", e),
		)
		return
	}
	s.logger.Info("geo scheduler cycle generated",
		slog.Uint64("plan_id", plan.ID),
		slog.Int("tasks", count),
		slog.String("next_run_at", formatTime(nextRun)),
	)
}

// calcNextRun computes the next execution time based on schedule_type.
// For once/manual the plan has no future cycle, so next_run_at is cleared (nil).
// For hourly/daily/weekly/monthly the interval is added to now.
// For cron the 5-field expression is parsed to find the next matching slot.
func calcNextRun(plan *MonitorPlan, from time.Time) *time.Time {
	switch plan.ScheduleType {
	case MonitorScheduleOnce, MonitorScheduleManual:
		return nil
	case MonitorScheduleHourly:
		t := from.Add(time.Hour)
		return &t
	case MonitorScheduleDaily:
		t := from.AddDate(0, 0, 1)
		return &t
	case MonitorScheduleWeekly:
		t := from.AddDate(0, 0, 7)
		return &t
	case MonitorScheduleMonthly:
		t := from.AddDate(0, 1, 0)
		return &t
	case MonitorScheduleCron:
		if next, ok := nextCronRun(plan.CronExpression, from); ok {
			return &next
		}
		// Fallback to daily if cron parsing fails.
		t := from.AddDate(0, 0, 1)
		return &t
	default:
		return nil
	}
}

// nextCronRun computes the next time matching a 5-field cron expression
// (minute hour day-of-month month day-of-week) after `from`.
// Supports: * , - / and numeric values. Does not support names or L/W.
func nextCronRun(expr string, from time.Time) (time.Time, bool) {
	fields := strings.Fields(strings.TrimSpace(expr))
	if len(fields) != 5 {
		return time.Time{}, false
	}
	minute, ok1 := parseCronField(fields[0], 0, 59)
	hour, ok2 := parseCronField(fields[1], 0, 23)
	dom, ok3 := parseCronField(fields[2], 1, 31)
	month, ok4 := parseCronField(fields[3], 1, 12)
	dow, ok5 := parseCronField(fields[4], 0, 6)
	if !ok1 || !ok2 || !ok3 || !ok4 || !ok5 {
		return time.Time{}, false
	}

	// Start from the next minute, zeroing seconds.
	cursor := from.Truncate(time.Minute).Add(time.Minute)
	// Search up to 366 days ahead to avoid infinite loops.
	deadline := from.AddDate(1, 0, 0)
	for cursor.Before(deadline) {
		if minute[cursor.Minute()] &&
			hour[cursor.Hour()] &&
			month[int(cursor.Month())] &&
			dom[cursor.Day()] &&
			dow[int(cursor.Weekday())] {
			return cursor, true
		}
		cursor = cursor.Add(time.Minute)
	}
	return time.Time{}, false
}

// parseCronField parses one cron field into a 7-day/24-hour/etc. lookup table.
func parseCronField(field string, min, max int) (map[int]bool, bool) {
	result := make(map[int]bool)
	for _, part := range strings.Split(field, ",") {
		step := 1
		if idx := strings.Index(part, "/"); idx >= 0 {
			s, err := strconv.Atoi(part[idx+1:])
			if err != nil || s <= 0 {
				return nil, false
			}
			step = s
			part = part[:idx]
		}
		lo, hi := min, max
		if part != "*" {
			if idx := strings.Index(part, "-"); idx >= 0 {
				loNum, err1 := strconv.Atoi(part[:idx])
				hiNum, err2 := strconv.Atoi(part[idx+1:])
				if err1 != nil || err2 != nil || loNum < min || hiNum > max || loNum > hiNum {
					return nil, false
				}
				lo, hi = loNum, hiNum
			} else {
				num, err := strconv.Atoi(part)
				if err != nil || num < min || num > max {
					return nil, false
				}
				lo, hi = num, num
			}
		}
		for v := lo; v <= hi; v += step {
			result[v] = true
		}
	}
	return result, true
}

func formatTime(t *time.Time) string {
	if t == nil {
		return "none"
	}
	return t.UTC().Format(time.RFC3339)
}
