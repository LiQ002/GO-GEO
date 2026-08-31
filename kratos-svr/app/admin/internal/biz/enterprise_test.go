package biz

import (
	"context"
	"testing"
	"time"

	"kratos-svr/internal/security"
)

type enterpriseRepoStub struct{ created CreateEnterpriseCommand }

func (r *enterpriseRepoStub) Create(_ context.Context, cmd CreateEnterpriseCommand) (*EnterpriseDetail, error) {
	r.created = cmd
	return cmd.Detail, nil
}
func (*enterpriseRepoStub) Get(context.Context, uint64) (*EnterpriseDetail, error) {
	return nil, ErrEnterpriseNotFound
}
func (*enterpriseRepoStub) List(context.Context, EnterpriseListOptions) ([]*EnterpriseDetail, int64, error) {
	return nil, 0, nil
}
func (*enterpriseRepoStub) Update(context.Context, *Enterprise, uint64) (*EnterpriseDetail, error) {
	return nil, nil
}
func (*enterpriseRepoStub) ChangeStatus(context.Context, EnterpriseStatusCommand) (*EnterpriseDetail, error) {
	return nil, nil
}
func (*enterpriseRepoStub) ResetPassword(context.Context, EnterprisePasswordCommand) (*EnterpriseAccount, error) {
	return nil, nil
}
func (*enterpriseRepoStub) SetSubscription(context.Context, SubscriptionCommand) (*Subscription, error) {
	return nil, nil
}
func (*enterpriseRepoStub) SetQuota(context.Context, QuotaCommand) (*QuotaLimit, error) {
	return nil, nil
}

func TestEnterpriseUsecaseCreateInitializesSingleAccount(t *testing.T) {
	repo := new(enterpriseRepoStub)
	uc := NewEnterpriseUsecase(repo)
	expiresAt := time.Now().UTC().Add(365 * 24 * time.Hour)
	_, err := uc.Create(context.Background(), CreateEnterpriseCommand{
		Detail: &EnterpriseDetail{
			Enterprise: &Enterprise{Code: "acme", Name: "Acme"},
			Account:    &EnterpriseAccount{Username: "owner"},
			Subscription: &Subscription{
				PlanID: 1,
			},
			Quotas: []*QuotaLimit{{Metric: "geo_queries", LimitValue: 100}},
		},
		InitialPassword:     "Initial@123",
		SubscriptionExpires: expiresAt,
		OperatorID:          7,
	})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if got := repo.created.Detail.Enterprise.Status; got != "active" {
		t.Errorf("enterprise status = %q, want active", got)
	}
	account := repo.created.Detail.Account
	if !account.MustChangePassword {
		t.Error("account MustChangePassword = false, want true")
	}
	if !security.ComparePassword(account.PasswordHash, "Initial@123") {
		t.Error("account password hash does not match initial password")
	}
	if got := repo.created.Detail.Subscription.ExpiresAt; !got.Equal(expiresAt) {
		t.Errorf("subscription expiry = %v, want %v", got, expiresAt)
	}
}

func TestEnterpriseUsecaseCreateRejectsPasswordOutsidePolicy(t *testing.T) {
	uc := NewEnterpriseUsecase(new(enterpriseRepoStub))
	_, err := uc.Create(context.Background(), CreateEnterpriseCommand{
		Detail: &EnterpriseDetail{
			Enterprise: &Enterprise{Code: "demo", Name: "Demo"},
			Account:    &EnterpriseAccount{Username: "demo"},
		},
		InitialPassword: "Demo@2026",
		OperatorID:      7,
	})
	if err != ErrEnterprisePasswordInvalid {
		t.Fatalf("Create() error = %v, want %v", err, ErrEnterprisePasswordInvalid)
	}
}

func TestEnterpriseUsecaseRejectsStatusChangeWithoutReason(t *testing.T) {
	uc := NewEnterpriseUsecase(new(enterpriseRepoStub))
	_, err := uc.ChangeStatus(context.Background(), EnterpriseStatusCommand{
		ID: 1, Version: 1, OperatorID: 7, Action: "suspend",
	})
	if err != ErrEnterpriseInvalid {
		t.Fatalf("ChangeStatus() error = %v, want %v", err, ErrEnterpriseInvalid)
	}
}
