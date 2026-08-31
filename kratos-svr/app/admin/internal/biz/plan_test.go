package biz

import (
	"context"
	"testing"
)

type planRepoStub struct {
	created *Plan
}

func (r *planRepoStub) Create(_ context.Context, item *Plan) (*Plan, error) {
	r.created = item
	return item, nil
}

func (*planRepoStub) Get(context.Context, uint64) (*Plan, error) { return nil, ErrPlanNotFound }
func (*planRepoStub) List(context.Context, PlanListOptions) ([]*Plan, int64, error) {
	return nil, 0, nil
}
func (*planRepoStub) Update(context.Context, *Plan) (*Plan, error) { return nil, nil }
func (*planRepoStub) Delete(context.Context, uint64) error         { return nil }

func TestPlanUsecaseCreateNormalizesStructuredConfiguration(t *testing.T) {
	repo := new(planRepoStub)
	uc := NewPlanUsecase(repo)

	_, err := uc.Create(context.Background(), &Plan{
		Code:   " starter ",
		Name:   " 入门版 ",
		Limits: []*PlanLimit{{Metric: PlanMetricArticleGenerations, LimitValue: 100}},
		Features: []*PlanFeature{{
			Feature: PlanFeatureArticleGeneration, Enabled: true,
		}},
	})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if got := repo.created.Limits[0].Period; got != QuotaPeriodMonthly {
		t.Errorf("limit period = %d, want %d", got, QuotaPeriodMonthly)
	}
	if got := repo.created.Features[0].Feature; got != PlanFeatureArticleGeneration {
		t.Errorf("feature = %d, want %d", got, PlanFeatureArticleGeneration)
	}
}

func TestPlanUsecaseCreateRejectsDuplicateLimitMetric(t *testing.T) {
	uc := NewPlanUsecase(new(planRepoStub))
	_, err := uc.Create(context.Background(), &Plan{
		Code: "starter", Name: "入门版", Status: PlanStatusActive,
		Limits: []*PlanLimit{
			{Metric: PlanMetricGEOQueries, LimitValue: 100, Period: QuotaPeriodMonthly},
			{Metric: PlanMetricGEOQueries, LimitValue: 200, Period: QuotaPeriodMonthly},
		},
	})
	if err != ErrPlanInvalid {
		t.Fatalf("Create() error = %v, want %v", err, ErrPlanInvalid)
	}
}
