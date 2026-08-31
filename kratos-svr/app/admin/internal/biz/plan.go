package biz

import (
	"context"
	"strings"
	"time"

	"github.com/go-kratos/kratos/v3/errors"
)

var (
	ErrPlanNotFound = errors.NotFound("PLAN_NOT_FOUND", "plan not found")
	ErrPlanInvalid  = errors.BadRequest("PLAN_INVALID", "invalid plan data")
	ErrPlanConflict = errors.Conflict("PLAN_CONFLICT", "plan already exists or is in use")
)

type Plan struct {
	ID                     uint64
	Code                   string
	Name                   string
	Description            string
	Status                 int32
	HalfYearlyPriceMinorUnits int64
	YearlyPriceMinorUnits     int64
	Currency               string
	BillingCycle           string
	VisibleToEnterprise    bool
	SortOrder              int32
	SeriesCode             string
	GrantedPoints          int64
	Limits                 []*PlanLimit
	Features               []*PlanFeature
	CreatedAt              time.Time
	UpdatedAt              time.Time
}

type PlanLimit struct {
	ID         uint64
	PlanID     uint64
	Metric     int32
	LimitValue int64
	Period     int32
}

type PlanFeature struct {
	ID      uint64
	PlanID  uint64
	Feature int32
	Enabled bool
}

type PlanListOptions struct {
	Offset, Limit int
	Status        int32
	Keyword       string
}

type PlanRepo interface {
	Create(context.Context, *Plan) (*Plan, error)
	Get(context.Context, uint64) (*Plan, error)
	List(context.Context, PlanListOptions) ([]*Plan, int64, error)
	Update(context.Context, *Plan) (*Plan, error)
	Delete(context.Context, uint64) error
}

type PlanUsecase struct{ repo PlanRepo }

func NewPlanUsecase(repo PlanRepo) *PlanUsecase { return &PlanUsecase{repo: repo} }

func (uc *PlanUsecase) Create(ctx context.Context, item *Plan) (*Plan, error) {
	normalizePlan(item)
	if !validPlan(item) {
		return nil, ErrPlanInvalid
	}
	return uc.repo.Create(ctx, item)
}

func (uc *PlanUsecase) Get(ctx context.Context, id uint64) (*Plan, error) {
	if id == 0 {
		return nil, ErrPlanInvalid
	}
	return uc.repo.Get(ctx, id)
}

func (uc *PlanUsecase) List(ctx context.Context, opts PlanListOptions) ([]*Plan, int64, error) {
	return uc.repo.List(ctx, opts)
}

func (uc *PlanUsecase) Update(ctx context.Context, item *Plan) (*Plan, error) {
	normalizePlan(item)
	if item == nil || item.ID == 0 || !validPlan(item) {
		return nil, ErrPlanInvalid
	}
	return uc.repo.Update(ctx, item)
}

func (uc *PlanUsecase) Delete(ctx context.Context, id uint64) error {
	if id == 0 {
		return ErrPlanInvalid
	}
	return uc.repo.Delete(ctx, id)
}

func validPlan(item *Plan) bool {
	if item == nil || item.Code == "" || item.Name == "" || !validPlanStatus(item.Status) {
		return false
	}
	limitMetrics := make(map[int32]struct{}, len(item.Limits))
	for _, limit := range item.Limits {
		if limit == nil {
			return false
		}
		// 使用白名单验证指标（只允许有效的 7 个指标）
		if _, valid := ValidPlanMetrics[limit.Metric]; !valid {
			return false
		}
		if limit.LimitValue < 0 || !validLimitPeriod(limit.Period) {
			return false
		}
		if _, exists := limitMetrics[limit.Metric]; exists {
			return false
		}
		limitMetrics[limit.Metric] = struct{}{}
	}
	featureCodes := make(map[int32]struct{}, len(item.Features))
	for _, feature := range item.Features {
		if feature == nil || !inRange(feature.Feature, PlanFeatureArticleGeneration, PlanFeatureOpinionAnalysis) {
			return false
		}
		if _, exists := featureCodes[feature.Feature]; exists {
			return false
		}
		featureCodes[feature.Feature] = struct{}{}
	}
	return true
}

func normalizePlan(item *Plan) {
	if item == nil {
		return
	}
	item.Code = strings.TrimSpace(item.Code)
	item.Name = strings.TrimSpace(item.Name)
	if item.Status == 0 {
		item.Status = PlanStatusActive
	}
	for _, limit := range item.Limits {
		if limit == nil {
			continue
		}
		if limit.Period == 0 {
			limit.Period = QuotaPeriodMonthly
		}
	}
}

func validPlanStatus(status int32) bool {
	return inRange(status, PlanStatusActive, PlanStatusArchived)
}

func validLimitPeriod(period int32) bool {
	return inRange(period, QuotaPeriodDaily, QuotaPeriodTotal)
}
