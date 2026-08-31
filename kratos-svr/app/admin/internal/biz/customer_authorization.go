package biz

import (
	"context"
	"strings"
	"time"

	"github.com/go-kratos/kratos/v3/errors"
)

var (
	ErrCustomerAuthorizationNotFound = errors.NotFound("CUSTOMER_AUTHORIZATION_NOT_FOUND", "customer authorization not found")
	ErrCustomerAuthorizationInvalid  = errors.BadRequest("CUSTOMER_AUTHORIZATION_INVALID", "invalid customer authorization request")
	ErrCustomerAuthorizationConflict = errors.Conflict("CUSTOMER_AUTHORIZATION_CONFLICT", "customer authorization version conflict")
)

// CustomerAuthorization is the platform-safe view of an enterprise platform authorization.
// It deliberately excludes all encrypted credential material and client metadata.
type CustomerAuthorization struct {
	ID, EnterpriseID, ResourceID                                              uint64
	EnterpriseCode, EnterpriseName, ResourceType, ResourceCode, ResourceName  string
	AccountName, ExternalID, MaskedIdentity, AuthorizationStatus, UsageStatus string
	ExpiresAt, LastVerifiedAt, LastUsedAt                                     *time.Time
	DailyLimit                                                                int64
	IsDefault                                                                 bool
	Version                                                                   uint64
	CreatedAt, UpdatedAt                                                      time.Time
}

type CustomerAuthorizationListOptions struct {
	Offset, Limit                                  int
	EnterpriseID, ResourceID                       uint64
	ResourceType, AuthorizationStatus, UsageStatus string
	Keyword                                        string
}

type CustomerAuthorizationAction struct {
	ID, Version, OperatorID uint64
	ResourceType            string
	Action, Reason          string
}

type CustomerAuthorizationRepo interface {
	Get(context.Context, uint64) (*CustomerAuthorization, error)
	List(context.Context, CustomerAuthorizationListOptions) ([]*CustomerAuthorization, int64, error)
	ChangeStatus(context.Context, CustomerAuthorizationAction) (*CustomerAuthorization, error)
}

type CustomerAuthorizationUsecase struct {
	repo CustomerAuthorizationRepo
}

func NewCustomerAuthorizationUsecase(repo CustomerAuthorizationRepo) *CustomerAuthorizationUsecase {
	return &CustomerAuthorizationUsecase{repo: repo}
}

func (uc *CustomerAuthorizationUsecase) Get(ctx context.Context, id uint64) (*CustomerAuthorization, error) {
	if id == 0 {
		return nil, ErrCustomerAuthorizationInvalid
	}
	return uc.repo.Get(ctx, id)
}

func (uc *CustomerAuthorizationUsecase) List(ctx context.Context, opts CustomerAuthorizationListOptions) ([]*CustomerAuthorization, int64, error) {
	if (opts.ResourceType != "" && opts.ResourceType != "publish_channel" && opts.ResourceType != "inclusion_site") || (opts.ResourceID != 0 && opts.ResourceType == "") {
		return nil, 0, ErrCustomerAuthorizationInvalid
	}
	return uc.repo.List(ctx, opts)
}

func (uc *CustomerAuthorizationUsecase) ChangeStatus(ctx context.Context, action CustomerAuthorizationAction) (*CustomerAuthorization, error) {
	if action.ID == 0 || action.Version == 0 || action.OperatorID == 0 || (action.ResourceType != "" && action.ResourceType != "publish_channel" && action.ResourceType != "inclusion_site") || !map[string]bool{
		"pause":  true,
		"resume": true,
		"revoke": true,
	}[strings.TrimSpace(action.Action)] {
		return nil, ErrCustomerAuthorizationInvalid
	}
	return uc.repo.ChangeStatus(ctx, action)
}
