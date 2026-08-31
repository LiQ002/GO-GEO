package biz

import (
	"context"
	"github.com/go-kratos/kratos/v3/errors"
	"strings"
	"time"
)

var (
	ErrAdminRoleNotFound = errors.NotFound("ADMIN_ROLE_NOT_FOUND", "admin role not found")
	ErrAdminRoleInvalid  = errors.BadRequest("ADMIN_ROLE_INVALID", "invalid admin role")
)

type AdminPermission struct {
	ID                                        uint64
	Code, Name, Resource, Action, Description string
}
type AdminRole struct {
	ID                      uint64
	Code, Name, Description string
	DataScope, Status       int32
	Permissions             []*AdminPermission
	CreatedAt, UpdatedAt    time.Time
}
type AdminRoleListOptions struct {
	Offset, Limit int
	Status        int32
	Keyword       string
}
type AdminRoleCommand struct {
	Role          *AdminRole
	PermissionIDs []uint64
	OperatorID    uint64
	Reason        string
}
type AdminRoleRepo interface {
	Create(context.Context, AdminRoleCommand) (*AdminRole, error)
	Get(context.Context, uint64) (*AdminRole, error)
	List(context.Context, AdminRoleListOptions) ([]*AdminRole, int64, error)
	Update(context.Context, AdminRoleCommand) (*AdminRole, error)
	Delete(context.Context, uint64, uint64, string) error
	ListPermissions(context.Context, string, string) ([]*AdminPermission, error)
	SetPermissions(context.Context, uint64, []uint64, uint64, string) (*AdminRole, error)
}
type AdminRoleUsecase struct{ repo AdminRoleRepo }

func NewAdminRoleUsecase(repo AdminRoleRepo) *AdminRoleUsecase { return &AdminRoleUsecase{repo: repo} }
func validRole(c AdminRoleCommand, update bool) bool {
	return c.Role != nil && (!update || c.Role.ID != 0) && c.OperatorID != 0 && strings.TrimSpace(c.Reason) != "" && strings.TrimSpace(c.Role.Code) != "" && strings.TrimSpace(c.Role.Name) != "" && inRange(c.Role.DataScope, AdminRoleDataScopeAll, AdminRoleDataScopeReadonly) && inRange(c.Role.Status, AdminRoleStatusActive, AdminRoleStatusDisabled)
}
func (u *AdminRoleUsecase) Create(ctx context.Context, c AdminRoleCommand) (*AdminRole, error) {
	if c.Role != nil && c.Role.Status == 0 {
		c.Role.Status = AdminRoleStatusActive
	}
	if !validRole(c, false) {
		return nil, ErrAdminRoleInvalid
	}
	return u.repo.Create(ctx, c)
}
func (u *AdminRoleUsecase) Get(ctx context.Context, id uint64) (*AdminRole, error) {
	if id == 0 {
		return nil, ErrAdminRoleInvalid
	}
	return u.repo.Get(ctx, id)
}
func (u *AdminRoleUsecase) List(ctx context.Context, o AdminRoleListOptions) ([]*AdminRole, int64, error) {
	return u.repo.List(ctx, o)
}
func (u *AdminRoleUsecase) Update(ctx context.Context, c AdminRoleCommand) (*AdminRole, error) {
	if !validRole(c, true) {
		return nil, ErrAdminRoleInvalid
	}
	return u.repo.Update(ctx, c)
}
func (u *AdminRoleUsecase) Delete(ctx context.Context, id, op uint64, reason string) error {
	if id == 0 || op == 0 || strings.TrimSpace(reason) == "" {
		return ErrAdminRoleInvalid
	}
	return u.repo.Delete(ctx, id, op, reason)
}
func (u *AdminRoleUsecase) ListPermissions(ctx context.Context, resource, keyword string) ([]*AdminPermission, error) {
	return u.repo.ListPermissions(ctx, resource, keyword)
}
func (u *AdminRoleUsecase) SetPermissions(ctx context.Context, id uint64, ids []uint64, op uint64, reason string) (*AdminRole, error) {
	if id == 0 || op == 0 || strings.TrimSpace(reason) == "" {
		return nil, ErrAdminRoleInvalid
	}
	return u.repo.SetPermissions(ctx, id, ids, op, reason)
}
