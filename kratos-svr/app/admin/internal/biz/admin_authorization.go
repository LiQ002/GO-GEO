package biz

import (
	"context"
	"github.com/go-kratos/kratos/v3/errors"
)

var ErrAdminForbidden = errors.Forbidden("ADMIN_PERMISSION_DENIED", "permission denied")

type AdminAuthorizationRepo interface {
	HasPermission(context.Context, uint64, string) (bool, error)
	DataScope(context.Context, uint64) (int32, error)
}

func (u *AdminAuthorizationUsecase) DataScope(ctx context.Context, userID uint64) (int32, error) {
	if userID == 0 {
		return 0, ErrAdminForbidden
	}
	scope, err := u.repo.DataScope(ctx, userID)
	if err != nil {
		return 0, err
	}
	if scope < AdminRoleDataScopeAll || scope > AdminRoleDataScopeReadonly {
		return 0, ErrAdminForbidden
	}
	return scope, nil
}

type AdminAuthorizationUsecase struct{ repo AdminAuthorizationRepo }

func NewAdminAuthorizationUsecase(repo AdminAuthorizationRepo) *AdminAuthorizationUsecase {
	return &AdminAuthorizationUsecase{repo: repo}
}
func (u *AdminAuthorizationUsecase) Authorize(ctx context.Context, userID uint64, permission string) error {
	if userID == 0 {
		return ErrAdminForbidden
	}
	ok, err := u.repo.HasPermission(ctx, userID, permission)
	if err != nil {
		return err
	}
	if !ok {
		return ErrAdminForbidden
	}
	return nil
}
