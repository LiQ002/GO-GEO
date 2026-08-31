package biz

import (
	"context"
	"time"
)

type DashboardMetric struct {
	Key, Label             string
	Value, ComparisonValue int64
}
type DashboardTrend struct {
	Date                                                  string
	Articles, PublishSucceeded, GeoSucceeded, FailedTasks int64
}
type DashboardAlert struct {
	ID                                        uint64
	Severity, Title, ResourceType, ResourceID string
	CreatedAt                                 time.Time
}
type DashboardPlatformStat struct {
	Platform, Label string
	Count           int64
	SuccessRate     float64
}
type DashboardActivity struct {
	ID                            uint64
	Type, Message                 string
	CreatedAt                     time.Time
}
type PlatformDashboard struct {
	Metrics       []*DashboardMetric
	Trends        []*DashboardTrend
	Alerts        []*DashboardAlert
	PlatformStats []*DashboardPlatformStat
	Activities    []*DashboardActivity
	GeneratedAt   time.Time
}
type DashboardRepo interface {
	Get(context.Context, int) (*PlatformDashboard, error)
}
type DashboardUsecase struct{ repo DashboardRepo }

func NewDashboardUsecase(repo DashboardRepo) *DashboardUsecase { return &DashboardUsecase{repo: repo} }
func (u *DashboardUsecase) Get(ctx context.Context, days int) (*PlatformDashboard, error) {
	if days < 1 || days > 90 {
		days = 14
	}
	return u.repo.Get(ctx, days)
}
