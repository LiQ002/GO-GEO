package biz

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/url"
	"strings"
	"time"

	"github.com/go-kratos/kratos/v3/errors"
)

var (
	ErrSalesOpportunityNotFound  = errors.NotFound("SALES_OPPORTUNITY_NOT_FOUND", "sales opportunity not found")
	ErrSalesOpportunityInvalid   = errors.BadRequest("SALES_OPPORTUNITY_INVALID", "invalid sales opportunity data")
	ErrSalesOpportunityConflict  = errors.Conflict("SALES_OPPORTUNITY_CONFLICT", "sales opportunity data has changed")
	ErrSalesOpportunityForbidden = errors.Forbidden("SALES_OPPORTUNITY_FORBIDDEN", "sales opportunity is outside the current data scope")
)

const (
	SalesOpportunityStatusFollowing int32 = 1
	SalesOpportunityStatusPaused    int32 = 2
	SalesOpportunityStatusClosed    int32 = 3
)

type SalesOpportunityBrandAlias struct {
	ID        uint64
	Alias     string
	SortOrder int32
}

type SalesOpportunityProduct struct {
	ID             uint64
	Name           string
	Description    string
	SellingPoints  string
	TargetAudience string
	SortOrder      int32
}

type SalesOpportunityCompetitor struct {
	ID          uint64
	Name        string
	Website     string
	Description string
	SortOrder   int32
}

type SalesOpportunity struct {
	ID                  uint64
	Code                string
	Name                string
	OwnerAdminID        uint64
	OwnerDisplayName    string
	CustomerName        string
	Website             string
	Industry            string
	Region              string
	ContactName         string
	ContactPhone        string
	ContactEmail        string
	BrandName           string
	TargetAudience      string
	CoreValue           string
	CurrentContent      string
	PainPoints          string
	ExpectedGoals       string
	BudgetMinMinorUnits int64
	BudgetMaxMinorUnits int64
	Currency            string
	Status              int32
	Remark              string
	BrandAliases        []*SalesOpportunityBrandAlias
	Products            []*SalesOpportunityProduct
	Competitors         []*SalesOpportunityCompetitor
	Version             uint64
	ClosedAt            *time.Time
	CreatedAt           time.Time
	UpdatedAt           time.Time
}

type SalesOpportunityOwner struct {
	ID          uint64
	Username    string
	DisplayName string
	Email       string
}

type SalesOpportunityAccess struct {
	AdminUserID uint64
	DataScope   int32
}

func (a SalesOpportunityAccess) CanAccessAll() bool {
	return a.DataScope == AdminRoleDataScopeAll || a.DataScope == AdminRoleDataScopeReadonly
}

func (a SalesOpportunityAccess) CanAssignOthers() bool { return a.CanAccessAll() }

type SalesOpportunityListOptions struct {
	Offset       int
	Limit        int
	Keyword      string
	Status       int32
	OwnerAdminID *uint64
}

type SalesOpportunityStatusCommand struct {
	ID         uint64
	Version    uint64
	Status     int32
	Reason     string
	OperatorID uint64
	Access     SalesOpportunityAccess
}

type SalesOpportunityDuplicateOptions struct {
	CustomerName string
	Website      string
	ExcludeID    *uint64
	Access       SalesOpportunityAccess
}

type SalesOpportunityRepo interface {
	Create(context.Context, *SalesOpportunity, uint64) (*SalesOpportunity, error)
	Get(context.Context, uint64, SalesOpportunityAccess) (*SalesOpportunity, error)
	List(context.Context, SalesOpportunityListOptions, SalesOpportunityAccess) ([]*SalesOpportunity, int64, error)
	Update(context.Context, *SalesOpportunity, uint64, SalesOpportunityAccess) (*SalesOpportunity, error)
	ChangeStatus(context.Context, SalesOpportunityStatusCommand) (*SalesOpportunity, error)
	CheckDuplicate(context.Context, SalesOpportunityDuplicateOptions) (bool, []*SalesOpportunity, error)
	ListOwners(context.Context, string, SalesOpportunityAccess) ([]*SalesOpportunityOwner, error)
}

type SalesOpportunityUsecase struct{ repo SalesOpportunityRepo }

func NewSalesOpportunityUsecase(repo SalesOpportunityRepo) *SalesOpportunityUsecase {
	return &SalesOpportunityUsecase{repo: repo}
}

func (uc *SalesOpportunityUsecase) Create(ctx context.Context, item *SalesOpportunity, access SalesOpportunityAccess) (*SalesOpportunity, error) {
	if access.AdminUserID == 0 || !validSalesOpportunityAccess(access) || item == nil {
		return nil, ErrSalesOpportunityInvalid
	}
	if item.OwnerAdminID == 0 {
		item.OwnerAdminID = access.AdminUserID
	}
	if !access.CanAssignOthers() && item.OwnerAdminID != access.AdminUserID {
		return nil, ErrSalesOpportunityForbidden
	}
	if err := normalizeSalesOpportunity(item); err != nil {
		return nil, err
	}
	code, err := newSalesOpportunityCode(time.Now().UTC())
	if err != nil {
		return nil, ErrSalesOpportunityInvalid
	}
	item.Code = code
	item.Status = SalesOpportunityStatusFollowing
	item.Version = 1
	return uc.repo.Create(ctx, item, access.AdminUserID)
}

func (uc *SalesOpportunityUsecase) Get(ctx context.Context, id uint64, access SalesOpportunityAccess) (*SalesOpportunity, error) {
	if id == 0 || !validSalesOpportunityAccess(access) {
		return nil, ErrSalesOpportunityInvalid
	}
	return uc.repo.Get(ctx, id, access)
}

func (uc *SalesOpportunityUsecase) List(ctx context.Context, opts SalesOpportunityListOptions, access SalesOpportunityAccess) ([]*SalesOpportunity, int64, error) {
	if !validSalesOpportunityAccess(access) || opts.Status < 0 || opts.Status > SalesOpportunityStatusClosed {
		return nil, 0, ErrSalesOpportunityInvalid
	}
	if !access.CanAccessAll() && opts.OwnerAdminID != nil && *opts.OwnerAdminID != access.AdminUserID {
		return nil, 0, ErrSalesOpportunityForbidden
	}
	return uc.repo.List(ctx, opts, access)
}

func (uc *SalesOpportunityUsecase) Update(ctx context.Context, item *SalesOpportunity, access SalesOpportunityAccess) (*SalesOpportunity, error) {
	if item == nil || item.ID == 0 || item.Version == 0 || !validSalesOpportunityAccess(access) {
		return nil, ErrSalesOpportunityInvalid
	}
	if item.OwnerAdminID == 0 {
		item.OwnerAdminID = access.AdminUserID
	}
	if !access.CanAssignOthers() && item.OwnerAdminID != access.AdminUserID {
		return nil, ErrSalesOpportunityForbidden
	}
	if err := normalizeSalesOpportunity(item); err != nil {
		return nil, err
	}
	return uc.repo.Update(ctx, item, access.AdminUserID, access)
}

func (uc *SalesOpportunityUsecase) ChangeStatus(ctx context.Context, cmd SalesOpportunityStatusCommand) (*SalesOpportunity, error) {
	if cmd.ID == 0 || cmd.Version == 0 || cmd.OperatorID == 0 || !validSalesOpportunityAccess(cmd.Access) ||
		!validSalesOpportunityStatus(cmd.Status) || strings.TrimSpace(cmd.Reason) == "" {
		return nil, ErrSalesOpportunityInvalid
	}
	return uc.repo.ChangeStatus(ctx, cmd)
}

func (uc *SalesOpportunityUsecase) CheckDuplicate(ctx context.Context, opts SalesOpportunityDuplicateOptions) (bool, []*SalesOpportunity, error) {
	if !validSalesOpportunityAccess(opts.Access) {
		return false, nil, ErrSalesOpportunityInvalid
	}
	opts.CustomerName = strings.TrimSpace(opts.CustomerName)
	var err error
	opts.Website, err = normalizeOptionalWebsite(opts.Website)
	if err != nil || opts.CustomerName == "" && opts.Website == "" {
		return false, nil, ErrSalesOpportunityInvalid
	}
	return uc.repo.CheckDuplicate(ctx, opts)
}

func (uc *SalesOpportunityUsecase) ListOwners(ctx context.Context, keyword string, access SalesOpportunityAccess) ([]*SalesOpportunityOwner, bool, error) {
	if !validSalesOpportunityAccess(access) {
		return nil, false, ErrSalesOpportunityInvalid
	}
	items, err := uc.repo.ListOwners(ctx, strings.TrimSpace(keyword), access)
	return items, access.CanAssignOthers(), err
}

func normalizeSalesOpportunity(item *SalesOpportunity) error {
	item.Name = strings.TrimSpace(item.Name)
	item.CustomerName = strings.TrimSpace(item.CustomerName)
	item.Industry = strings.TrimSpace(item.Industry)
	item.Region = strings.TrimSpace(item.Region)
	item.ContactName = strings.TrimSpace(item.ContactName)
	item.ContactPhone = strings.TrimSpace(item.ContactPhone)
	item.ContactEmail = strings.TrimSpace(item.ContactEmail)
	item.BrandName = strings.TrimSpace(item.BrandName)
	item.TargetAudience = strings.TrimSpace(item.TargetAudience)
	item.CoreValue = strings.TrimSpace(item.CoreValue)
	item.CurrentContent = strings.TrimSpace(item.CurrentContent)
	item.PainPoints = strings.TrimSpace(item.PainPoints)
	item.ExpectedGoals = strings.TrimSpace(item.ExpectedGoals)
	item.Remark = strings.TrimSpace(item.Remark)
	item.Currency = strings.ToUpper(strings.TrimSpace(item.Currency))
	if item.Currency == "" {
		item.Currency = "CNY"
	}
	website, err := normalizeOptionalWebsite(item.Website)
	if err != nil {
		return ErrSalesOpportunityInvalid
	}
	item.Website = website
	if item.Name == "" || item.CustomerName == "" || item.BrandName == "" || len(item.Currency) != 3 ||
		item.BudgetMinMinorUnits < 0 || item.BudgetMaxMinorUnits < 0 ||
		(item.BudgetMaxMinorUnits != 0 && item.BudgetMaxMinorUnits < item.BudgetMinMinorUnits) {
		return ErrSalesOpportunityInvalid
	}
	if item.Status != 0 && !validSalesOpportunityStatus(item.Status) {
		return ErrSalesOpportunityInvalid
	}
	if len(item.BrandAliases) > 50 || len(item.Products) > 50 || len(item.Competitors) > 50 {
		return ErrSalesOpportunityInvalid
	}
	aliases := make([]*SalesOpportunityBrandAlias, 0, len(item.BrandAliases))
	seenAliases := make(map[string]struct{}, len(item.BrandAliases))
	for _, alias := range item.BrandAliases {
		if alias == nil {
			continue
		}
		alias.Alias = strings.TrimSpace(alias.Alias)
		if alias.Alias == "" {
			continue
		}
		key := strings.ToLower(alias.Alias)
		if _, ok := seenAliases[key]; ok {
			continue
		}
		seenAliases[key] = struct{}{}
		alias.SortOrder = int32(len(aliases))
		aliases = append(aliases, alias)
	}
	item.BrandAliases = aliases
	products := make([]*SalesOpportunityProduct, 0, len(item.Products))
	for _, product := range item.Products {
		if product == nil {
			continue
		}
		product.Name = strings.TrimSpace(product.Name)
		product.Description = strings.TrimSpace(product.Description)
		product.SellingPoints = strings.TrimSpace(product.SellingPoints)
		product.TargetAudience = strings.TrimSpace(product.TargetAudience)
		if product.Name == "" {
			return ErrSalesOpportunityInvalid
		}
		product.SortOrder = int32(len(products))
		products = append(products, product)
	}
	item.Products = products
	competitors := make([]*SalesOpportunityCompetitor, 0, len(item.Competitors))
	for _, competitor := range item.Competitors {
		if competitor == nil {
			continue
		}
		competitor.Name = strings.TrimSpace(competitor.Name)
		competitor.Description = strings.TrimSpace(competitor.Description)
		competitor.Website, err = normalizeOptionalWebsite(competitor.Website)
		if err != nil || competitor.Name == "" {
			return ErrSalesOpportunityInvalid
		}
		competitor.SortOrder = int32(len(competitors))
		competitors = append(competitors, competitor)
	}
	item.Competitors = competitors
	return nil
}

func normalizeOptionalWebsite(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", nil
	}
	if !strings.Contains(raw, "://") {
		raw = "https://" + raw
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" || parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", ErrSalesOpportunityInvalid
	}
	parsed.Host = strings.ToLower(parsed.Host)
	parsed.Fragment = ""
	return strings.TrimRight(parsed.String(), "/"), nil
}

func validSalesOpportunityStatus(status int32) bool {
	return status >= SalesOpportunityStatusFollowing && status <= SalesOpportunityStatusClosed
}

func validSalesOpportunityAccess(access SalesOpportunityAccess) bool {
	return access.AdminUserID != 0 && access.DataScope >= AdminRoleDataScopeAll && access.DataScope <= AdminRoleDataScopeReadonly
}

func newSalesOpportunityCode(now time.Time) (string, error) {
	random := make([]byte, 4)
	if _, err := rand.Read(random); err != nil {
		return "", err
	}
	return "SO" + now.Format("20060102") + strings.ToUpper(hex.EncodeToString(random)), nil
}
