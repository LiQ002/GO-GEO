package biz

import (
	"context"
	"errors"
	"strings"
	"testing"
)

type fakeSalesOpportunityRepo struct {
	created *SalesOpportunity
	listed  SalesOpportunityListOptions
}

func (r *fakeSalesOpportunityRepo) Create(_ context.Context, item *SalesOpportunity, _ uint64) (*SalesOpportunity, error) {
	r.created = item
	return item, nil
}

func (*fakeSalesOpportunityRepo) Get(context.Context, uint64, SalesOpportunityAccess) (*SalesOpportunity, error) {
	return nil, nil
}

func (r *fakeSalesOpportunityRepo) List(_ context.Context, opts SalesOpportunityListOptions, _ SalesOpportunityAccess) ([]*SalesOpportunity, int64, error) {
	r.listed = opts
	return nil, 0, nil
}

func (*fakeSalesOpportunityRepo) Update(context.Context, *SalesOpportunity, uint64, SalesOpportunityAccess) (*SalesOpportunity, error) {
	return nil, nil
}

func (*fakeSalesOpportunityRepo) ChangeStatus(context.Context, SalesOpportunityStatusCommand) (*SalesOpportunity, error) {
	return nil, nil
}

func (*fakeSalesOpportunityRepo) CheckDuplicate(context.Context, SalesOpportunityDuplicateOptions) (bool, []*SalesOpportunity, error) {
	return false, nil, nil
}

func (*fakeSalesOpportunityRepo) ListOwners(context.Context, string, SalesOpportunityAccess) ([]*SalesOpportunityOwner, error) {
	return nil, nil
}

func TestSalesOpportunityCreateNormalizesCustomerProfile(t *testing.T) {
	repo := &fakeSalesOpportunityRepo{}
	uc := NewSalesOpportunityUsecase(repo)
	item, err := uc.Create(context.Background(), &SalesOpportunity{
		Name:         "  华东区域 GEO 项目  ",
		CustomerName: " 示例科技 ",
		Website:      "EXAMPLE.COM/",
		BrandName:    " 示例品牌 ",
		BrandAliases: []*SalesOpportunityBrandAlias{{Alias: " Example "}, {Alias: "example"}, {Alias: " "}},
		Products:     []*SalesOpportunityProduct{{Name: " 产品 A ", SellingPoints: " 快速交付 "}},
		Competitors:  []*SalesOpportunityCompetitor{{Name: " 竞品 A ", Website: "competitor.example.com/"}},
	}, SalesOpportunityAccess{AdminUserID: 7, DataScope: AdminRoleDataScopeAssigned})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if item.OwnerAdminID != 7 || item.Status != SalesOpportunityStatusFollowing || item.Version != 1 {
		t.Fatalf("Create() defaults = owner %d, status %d, version %d", item.OwnerAdminID, item.Status, item.Version)
	}
	if !strings.HasPrefix(item.Code, "SO") || len(item.Code) != 18 {
		t.Fatalf("Create() code = %q", item.Code)
	}
	if item.Website != "https://example.com" || item.Currency != "CNY" {
		t.Fatalf("Create() normalized website/currency = %q/%q", item.Website, item.Currency)
	}
	if len(item.BrandAliases) != 1 || item.BrandAliases[0].Alias != "Example" || item.BrandAliases[0].SortOrder != 0 {
		t.Fatalf("Create() aliases = %#v", item.BrandAliases)
	}
	if len(item.Products) != 1 || item.Products[0].Name != "产品 A" || item.Products[0].SortOrder != 0 {
		t.Fatalf("Create() products = %#v", item.Products)
	}
	if len(item.Competitors) != 1 || item.Competitors[0].Website != "https://competitor.example.com" {
		t.Fatalf("Create() competitors = %#v", item.Competitors)
	}
}

func TestSalesOpportunityCreateRejectsAssigningAnotherOwnerWithAssignedScope(t *testing.T) {
	uc := NewSalesOpportunityUsecase(&fakeSalesOpportunityRepo{})
	_, err := uc.Create(context.Background(), &SalesOpportunity{
		Name: "机会", CustomerName: "客户", BrandName: "品牌", OwnerAdminID: 8,
	}, SalesOpportunityAccess{AdminUserID: 7, DataScope: AdminRoleDataScopeAssigned})
	if !errors.Is(err, ErrSalesOpportunityForbidden) {
		t.Fatalf("Create() error = %v, want ErrSalesOpportunityForbidden", err)
	}
}

func TestSalesOpportunityRejectsInvalidBudgetAndWebsite(t *testing.T) {
	tests := []SalesOpportunity{
		{Name: "机会", CustomerName: "客户", BrandName: "品牌", BudgetMinMinorUnits: 200, BudgetMaxMinorUnits: 100},
		{Name: "机会", CustomerName: "客户", BrandName: "品牌", Website: "ftp://example.com"},
	}
	for i := range tests {
		item := tests[i]
		if err := normalizeSalesOpportunity(&item); !errors.Is(err, ErrSalesOpportunityInvalid) {
			t.Errorf("normalizeSalesOpportunity(%d) error = %v", i, err)
		}
	}
}

func TestSalesOpportunityListEnforcesAssignedScope(t *testing.T) {
	repo := &fakeSalesOpportunityRepo{}
	uc := NewSalesOpportunityUsecase(repo)
	otherOwner := uint64(8)
	_, _, err := uc.List(context.Background(), SalesOpportunityListOptions{OwnerAdminID: &otherOwner}, SalesOpportunityAccess{
		AdminUserID: 7, DataScope: AdminRoleDataScopeAssigned,
	})
	if !errors.Is(err, ErrSalesOpportunityForbidden) {
		t.Fatalf("List() error = %v, want ErrSalesOpportunityForbidden", err)
	}
}
