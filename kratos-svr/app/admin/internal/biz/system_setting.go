package biz

import (
	"context"
	"encoding/json"
	"github.com/go-kratos/kratos/v3/errors"
	"strings"
	"time"
)

var (
	ErrSystemSettingNotFound = errors.NotFound("SYSTEM_SETTING_NOT_FOUND", "system setting not found")
	ErrSystemSettingInvalid  = errors.BadRequest("SYSTEM_SETTING_INVALID", "invalid system setting")
	ErrSystemSettingConflict = errors.Conflict("SYSTEM_SETTING_CONFLICT", "system setting data has changed")
)

type SystemSetting struct {
	ID                                     uint64
	Namespace, Key, ValueJSON, Description string
	Sensitive                              bool
	Version                                uint64
	CreatedAt, UpdatedAt                   time.Time
}
type SystemSettingListOptions struct {
	Offset, Limit      int
	Namespace, Keyword string
}
type SystemSettingCommand struct {
	Setting    *SystemSetting
	OperatorID uint64
	Reason     string
}
type DeleteSystemSettingCommand struct {
	ID, Version, OperatorID uint64
	Reason                  string
}
type SystemSettingRepo interface {
	Create(context.Context, SystemSettingCommand) (*SystemSetting, error)
	Get(context.Context, uint64) (*SystemSetting, error)
	List(context.Context, SystemSettingListOptions) ([]*SystemSetting, int64, error)
	Update(context.Context, SystemSettingCommand) (*SystemSetting, error)
	Delete(context.Context, DeleteSystemSettingCommand) error
}
type SystemSettingUsecase struct{ repo SystemSettingRepo }

func NewSystemSettingUsecase(repo SystemSettingRepo) *SystemSettingUsecase {
	return &SystemSettingUsecase{repo: repo}
}
func validSetting(c SystemSettingCommand, update bool) bool {
	return c.Setting != nil && (!update || c.Setting.ID != 0 && c.Setting.Version != 0) && c.OperatorID != 0 && strings.TrimSpace(c.Reason) != "" && strings.TrimSpace(c.Setting.Namespace) != "" && strings.TrimSpace(c.Setting.Key) != "" && json.Valid([]byte(c.Setting.ValueJSON))
}
func (u *SystemSettingUsecase) Create(ctx context.Context, c SystemSettingCommand) (*SystemSetting, error) {
	if !validSetting(c, false) {
		return nil, ErrSystemSettingInvalid
	}
	c.Setting.Version = 1
	return u.repo.Create(ctx, c)
}
func (u *SystemSettingUsecase) Get(ctx context.Context, id uint64) (*SystemSetting, error) {
	if id == 0 {
		return nil, ErrSystemSettingInvalid
	}
	return u.repo.Get(ctx, id)
}
func (u *SystemSettingUsecase) List(ctx context.Context, o SystemSettingListOptions) ([]*SystemSetting, int64, error) {
	return u.repo.List(ctx, o)
}
func (u *SystemSettingUsecase) Update(ctx context.Context, c SystemSettingCommand) (*SystemSetting, error) {
	if !validSetting(c, true) {
		return nil, ErrSystemSettingInvalid
	}
	return u.repo.Update(ctx, c)
}
func (u *SystemSettingUsecase) Delete(ctx context.Context, c DeleteSystemSettingCommand) error {
	if c.ID == 0 || c.Version == 0 || c.OperatorID == 0 || strings.TrimSpace(c.Reason) == "" {
		return ErrSystemSettingInvalid
	}
	return u.repo.Delete(ctx, c)
}
