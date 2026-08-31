package biz

import (
	"context"
	"github.com/go-kratos/kratos/v3/errors"
	"kratos-svr/internal/security"
	"strings"
	"time"
)

var (
	ErrAdminUserNotFound = errors.NotFound("ADMIN_USER_NOT_FOUND", "admin user not found")
	ErrAdminUserInvalid  = errors.BadRequest("ADMIN_USER_INVALID", "invalid admin user operation")
)

type ManagedAdminUser struct {
	ID                                                 uint64
	Username, DisplayName, Email, Status, PasswordHash string
	FailedLoginCount                                   uint32
	LockedUntil, LastLoginAt                           *time.Time
	Roles                                              []*AdminRole
	CreatedAt, UpdatedAt                               time.Time
}
type AdminUserListOptions struct {
	Offset, Limit   int
	Status, Keyword string
	RoleID          uint64
}
type AdminUserCommand struct {
	User            *ManagedAdminUser
	InitialPassword string
	RoleIDs         []uint64
	OperatorID      uint64
	Reason          string
}
type AdminUserRepo interface {
	Create(context.Context, AdminUserCommand) (*ManagedAdminUser, error)
	Get(context.Context, uint64) (*ManagedAdminUser, error)
	List(context.Context, AdminUserListOptions) ([]*ManagedAdminUser, int64, error)
	Update(context.Context, AdminUserCommand) (*ManagedAdminUser, error)
	ChangeStatus(context.Context, uint64, string, uint64, string) (*ManagedAdminUser, error)
	ResetPassword(context.Context, uint64, string, uint64, string) (*ManagedAdminUser, error)
	SetRoles(context.Context, uint64, []uint64, uint64, string) (*ManagedAdminUser, error)
}
type AdminUserUsecase struct{ repo AdminUserRepo }

func NewAdminUserUsecase(repo AdminUserRepo) *AdminUserUsecase { return &AdminUserUsecase{repo: repo} }
func (u *AdminUserUsecase) Create(ctx context.Context, c AdminUserCommand) (*ManagedAdminUser, error) {
	if c.User == nil || c.OperatorID == 0 || strings.TrimSpace(c.Reason) == "" || strings.TrimSpace(c.User.Username) == "" || strings.TrimSpace(c.User.DisplayName) == "" || len(c.InitialPassword) < 8 {
		return nil, ErrAdminUserInvalid
	}
	hash, err := security.HashPassword(c.InitialPassword)
	if err != nil {
		return nil, ErrAdminUserInvalid
	}
	c.User.PasswordHash = hash
	c.User.Status = "active"
	return u.repo.Create(ctx, c)
}
func (u *AdminUserUsecase) Get(ctx context.Context, id uint64) (*ManagedAdminUser, error) {
	if id == 0 {
		return nil, ErrAdminUserInvalid
	}
	return u.repo.Get(ctx, id)
}
func (u *AdminUserUsecase) List(ctx context.Context, o AdminUserListOptions) ([]*ManagedAdminUser, int64, error) {
	return u.repo.List(ctx, o)
}
func (u *AdminUserUsecase) Update(ctx context.Context, c AdminUserCommand) (*ManagedAdminUser, error) {
	if c.User == nil || c.User.ID == 0 || c.OperatorID == 0 || strings.TrimSpace(c.Reason) == "" || strings.TrimSpace(c.User.DisplayName) == "" {
		return nil, ErrAdminUserInvalid
	}
	return u.repo.Update(ctx, c)
}
func (u *AdminUserUsecase) ChangeStatus(ctx context.Context, id uint64, action string, op uint64, reason string) (*ManagedAdminUser, error) {
	if id == 0 || op == 0 || id == op || strings.TrimSpace(reason) == "" || !map[string]bool{"activate": true, "suspend": true}[action] {
		return nil, ErrAdminUserInvalid
	}
	return u.repo.ChangeStatus(ctx, id, action, op, reason)
}
func (u *AdminUserUsecase) ResetPassword(ctx context.Context, id uint64, password string, op uint64, reason string) (*ManagedAdminUser, error) {
	if id == 0 || op == 0 || len(password) < 8 || strings.TrimSpace(reason) == "" {
		return nil, ErrAdminUserInvalid
	}
	hash, err := security.HashPassword(password)
	if err != nil {
		return nil, ErrAdminUserInvalid
	}
	return u.repo.ResetPassword(ctx, id, hash, op, reason)
}
func (u *AdminUserUsecase) SetRoles(ctx context.Context, id uint64, ids []uint64, op uint64, reason string) (*ManagedAdminUser, error) {
	if id == 0 || op == 0 || strings.TrimSpace(reason) == "" || len(ids) == 0 {
		return nil, ErrAdminUserInvalid
	}
	return u.repo.SetRoles(ctx, id, ids, op, reason)
}
