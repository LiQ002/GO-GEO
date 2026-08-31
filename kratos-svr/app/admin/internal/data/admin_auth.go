package data

import (
	"context"
	"errors"
	"strings"
	"time"

	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/authn"
	"kratos-svr/internal/data/model"

	"gorm.io/gorm"
)

type adminAuthRepo struct{ data *Data }

func NewAdminAuthRepo(data *Data) biz.AdminAuthRepo { return &adminAuthRepo{data: data} }

func (r *adminAuthRepo) FindByUsername(ctx context.Context, username string) (*biz.AdminProfile, error) {
	var user model.AdminUser
	if err := r.data.DB(ctx).Where("username = ?", username).First(&user).Error; err != nil {
		return nil, mapAdminAuthError(err)
	}
	return r.profile(ctx, &user)
}
func (r *adminAuthRepo) FindByID(ctx context.Context, id uint64) (*biz.AdminProfile, error) {
	var user model.AdminUser
	if err := r.data.DB(ctx).First(&user, id).Error; err != nil {
		return nil, mapAdminAuthError(err)
	}
	return r.profile(ctx, &user)
}
func (r *adminAuthRepo) profile(ctx context.Context, user *model.AdminUser) (*biz.AdminProfile, error) {
	var roles []string
	if err := activeAdminRoleQuery(r.data.DB(ctx), user.ID).Select("r.code").Scan(&roles).Error; err != nil {
		return nil, err
	}
	var permissions []string
	if err := activeAdminPermissionQuery(r.data.DB(ctx), user.ID).Distinct("p.code").Scan(&permissions).Error; err != nil {
		return nil, err
	}
	return &biz.AdminProfile{ID: user.ID, Username: user.Username, DisplayName: user.DisplayName, Email: user.Email, Status: user.Status, PasswordHash: user.PasswordHash, Roles: roles, Permissions: permissions, FailedLoginCount: user.FailedLoginCount, LockedUntil: user.LockedUntil, LastLoginAt: user.LastLoginAt}, nil
}
func (r *adminAuthRepo) RecordLoginFailure(ctx context.Context, id uint64, count uint32, lockedUntil time.Time) error {
	updates := map[string]any{"failed_login_count": count}
	if lockedUntil.IsZero() {
		updates["locked_until"] = nil
	} else {
		updates["locked_until"] = lockedUntil
	}
	return r.data.DB(ctx).Model(&model.AdminUser{}).Where("id = ?", id).Updates(updates).Error
}
func (r *adminAuthRepo) RecordLoginSuccess(ctx context.Context, id uint64, at time.Time) error {
	return r.data.DB(ctx).Model(&model.AdminUser{}).Where("id = ?", id).Updates(map[string]any{"failed_login_count": 0, "locked_until": nil, "last_login_at": at}).Error
}
func (r *adminAuthRepo) CreateSession(ctx context.Context, subjectID uint64, meta biz.SessionMetadata, expiresAt time.Time) (*biz.AdminSession, error) {
	placeholder, err := authn.RandomToken(32)
	if err != nil {
		return nil, err
	}
	po := &model.LoginSession{SubjectType: "admin", SubjectID: subjectID, Audience: "geo-admin", RefreshTokenHash: authn.TokenHash(placeholder), DeviceID: meta.DeviceID, IPAddress: meta.IPAddress, UserAgent: meta.UserAgent, ExpiresAt: expiresAt, LastSeenAt: time.Now().UTC()}
	if err := r.data.DB(ctx).Create(po).Error; err != nil {
		return nil, err
	}
	return &biz.AdminSession{ID: po.ID, SubjectID: po.SubjectID, RefreshTokenHash: po.RefreshTokenHash, ExpiresAt: po.ExpiresAt}, nil
}
func (r *adminAuthRepo) RotateSession(ctx context.Context, id uint64, hash string, expiresAt time.Time) error {
	res := r.data.DB(ctx).Model(&model.LoginSession{}).Where("id = ? AND subject_type = ? AND revoked_at IS NULL", id, "admin").Updates(map[string]any{"refresh_token_hash": hash, "expires_at": expiresAt, "last_seen_at": time.Now().UTC()})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected != 1 {
		return biz.ErrAdminSession
	}
	return nil
}
func (r *adminAuthRepo) FindSession(ctx context.Context, id uint64, hash string) (*biz.AdminSession, error) {
	var po model.LoginSession
	if err := r.data.DB(ctx).Where("id = ? AND subject_type = ? AND refresh_token_hash = ? AND revoked_at IS NULL AND expires_at > ?", id, "admin", hash, time.Now().UTC()).First(&po).Error; err != nil {
		return nil, biz.ErrAdminSession
	}
	return &biz.AdminSession{ID: po.ID, SubjectID: po.SubjectID, RefreshTokenHash: po.RefreshTokenHash, ExpiresAt: po.ExpiresAt, RevokedAt: po.RevokedAt}, nil
}
func (r *adminAuthRepo) RevokeSession(ctx context.Context, id uint64, reason string) error {
	return r.data.DB(ctx).Model(&model.LoginSession{}).Where("id = ? AND subject_type = ? AND revoked_at IS NULL", id, "admin").Updates(map[string]any{"revoked_at": time.Now().UTC(), "revoke_reason": reason}).Error
}
func (r *adminAuthRepo) RevokeAllSessions(ctx context.Context, subjectID uint64, reason string) error {
	return r.data.DB(ctx).Model(&model.LoginSession{}).Where("subject_id = ? AND subject_type = ? AND revoked_at IS NULL", subjectID, "admin").Updates(map[string]any{"revoked_at": time.Now().UTC(), "revoke_reason": reason}).Error
}
func (r *adminAuthRepo) UpdatePassword(ctx context.Context, id uint64, hash string, at time.Time) error {
	return r.data.DB(ctx).Model(&model.AdminUser{}).Where("id = ?", id).Updates(map[string]any{"password_hash": hash, "password_changed_at": at}).Error
}
func mapAdminAuthError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return biz.ErrAdminCredentials
	}
	if strings.Contains(err.Error(), "Duplicate") {
		return biz.ErrAdminSession
	}
	return err
}
