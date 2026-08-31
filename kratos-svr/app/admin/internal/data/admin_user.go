package data

import (
	"context"
	"errors"
	"gorm.io/gorm"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/data/model"
	"strconv"
	"time"
)

type adminUserRepo struct{ data *Data }

func NewAdminUserRepo(data *Data) biz.AdminUserRepo { return &adminUserRepo{data: data} }
func (r *adminUserRepo) Create(ctx context.Context, c biz.AdminUserCommand) (*biz.ManagedAdminUser, error) {
	var id uint64
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		v := adminUserPO(c.User)
		if err := tx.Create(v).Error; err != nil {
			return err
		}
		id = v.ID
		if err := replaceUserRoles(tx, id, c.RoleIDs); err != nil {
			return err
		}
		return writeAdminAudit(ctx, tx, c.OperatorID, "admin_user.create", "admin_user", strconv.FormatUint(id, 10), "success", c.Reason, nil, map[string]any{"username": v.Username, "roles": c.RoleIDs})
	})
	if err != nil {
		return nil, mapAdminUserError(err)
	}
	return r.Get(ctx, id)
}
func (r *adminUserRepo) Get(ctx context.Context, id uint64) (*biz.ManagedAdminUser, error) {
	var v model.AdminUser
	if err := r.data.DB(ctx).First(&v, id).Error; err != nil {
		return nil, mapAdminUserError(err)
	}
	return r.hydrate(ctx, []model.AdminUser{v})[0], nil
}
func (r *adminUserRepo) List(ctx context.Context, o biz.AdminUserListOptions) ([]*biz.ManagedAdminUser, int64, error) {
	db := r.data.DB(ctx).Model(&model.AdminUser{})
	if o.Status != "" {
		db = db.Where("status = ?", o.Status)
	}
	if o.Keyword != "" {
		k := "%" + o.Keyword + "%"
		db = db.Where("username LIKE ? OR display_name LIKE ? OR email LIKE ?", k, k, k)
	}
	if o.RoleID != 0 {
		db = db.Where("EXISTS (SELECT 1 FROM "+model.TableAdminRoleBindings+" b WHERE b.admin_user_id="+model.TableAdminUsers+".id AND b.role_id=?)", o.RoleID)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var xs []model.AdminUser
	if err := db.Order("id ASC").Offset(o.Offset).Limit(o.Limit).Find(&xs).Error; err != nil {
		return nil, 0, err
	}
	return r.hydrate(ctx, xs), total, nil
}
func (r *adminUserRepo) Update(ctx context.Context, c biz.AdminUserCommand) (*biz.ManagedAdminUser, error) {
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var before model.AdminUser
		if err := tx.First(&before, c.User.ID).Error; err != nil {
			return err
		}
		updates := map[string]any{"display_name": c.User.DisplayName, "email": c.User.Email}
		if err := tx.Model(&before).Updates(updates).Error; err != nil {
			return err
		}
		return writeAdminAudit(ctx, tx, c.OperatorID, "admin_user.update", "admin_user", strconv.FormatUint(c.User.ID, 10), "success", c.Reason, before, updates)
	})
	if err != nil {
		return nil, mapAdminUserError(err)
	}
	return r.Get(ctx, c.User.ID)
}
func (r *adminUserRepo) ChangeStatus(ctx context.Context, id uint64, action string, op uint64, reason string) (*biz.ManagedAdminUser, error) {
	status := "suspended"
	if action == "activate" {
		status = "active"
	}
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var before model.AdminUser
		if err := tx.First(&before, id).Error; err != nil {
			return err
		}
		if err := tx.Model(&before).Update("status", status).Error; err != nil {
			return err
		}
		if status != "active" {
			if err := tx.Model(&model.LoginSession{}).Where("subject_type = ? AND subject_id = ? AND revoked_at IS NULL", "admin", id).Updates(map[string]any{"revoked_at": time.Now().UTC(), "revoke_reason": "admin_suspended"}).Error; err != nil {
				return err
			}
		}
		return writeAdminAudit(ctx, tx, op, "admin_user.status."+action, "admin_user", strconv.FormatUint(id, 10), "success", reason, before, map[string]any{"status": status})
	})
	if err != nil {
		return nil, mapAdminUserError(err)
	}
	return r.Get(ctx, id)
}
func (r *adminUserRepo) ResetPassword(ctx context.Context, id uint64, hash string, op uint64, reason string) (*biz.ManagedAdminUser, error) {
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		if err := tx.Model(&model.AdminUser{}).Where("id = ?", id).Updates(map[string]any{"password_hash": hash, "password_changed_at": time.Now().UTC(), "failed_login_count": 0, "locked_until": nil}).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.LoginSession{}).Where("subject_type = ? AND subject_id = ? AND revoked_at IS NULL", "admin", id).Updates(map[string]any{"revoked_at": time.Now().UTC(), "revoke_reason": "admin_password_reset"}).Error; err != nil {
			return err
		}
		return writeAdminAudit(ctx, tx, op, "admin_user.password.reset", "admin_user", strconv.FormatUint(id, 10), "success", reason, nil, nil)
	})
	if err != nil {
		return nil, mapAdminUserError(err)
	}
	return r.Get(ctx, id)
}
func (r *adminUserRepo) SetRoles(ctx context.Context, id uint64, ids []uint64, op uint64, reason string) (*biz.ManagedAdminUser, error) {
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		if err := replaceUserRoles(tx, id, ids); err != nil {
			return err
		}
		if err := tx.Model(&model.LoginSession{}).Where("subject_type = ? AND subject_id = ? AND revoked_at IS NULL", "admin", id).Updates(map[string]any{"revoked_at": time.Now().UTC(), "revoke_reason": "admin_roles_changed"}).Error; err != nil {
			return err
		}
		return writeAdminAudit(ctx, tx, op, "admin_user.roles.set", "admin_user", strconv.FormatUint(id, 10), "success", reason, nil, map[string]any{"role_ids": ids})
	})
	if err != nil {
		return nil, mapAdminUserError(err)
	}
	return r.Get(ctx, id)
}
func replaceUserRoles(tx *gorm.DB, id uint64, ids []uint64) error {
	if err := tx.Where("admin_user_id = ?", id).Delete(&model.AdminRoleBinding{}).Error; err != nil {
		return err
	}
	for _, rid := range ids {
		if err := tx.Create(&model.AdminRoleBinding{AdminUserID: id, RoleID: rid}).Error; err != nil {
			return err
		}
	}
	return nil
}
func (r *adminUserRepo) hydrate(ctx context.Context, xs []model.AdminUser) []*biz.ManagedAdminUser {
	out := make([]*biz.ManagedAdminUser, 0, len(xs))
	for i := range xs {
		v := &xs[i]
		item := adminUserDO(v)
		var roles []model.AdminRole
		r.data.DB(ctx).Table(model.TableAdminRoles+" AS r").Select("r.*").Joins("JOIN "+model.TableAdminRoleBindings+" AS b ON b.role_id=r.id").Where("b.admin_user_id = ?", v.ID).Find(&roles)
		for j := range roles {
			item.Roles = append(item.Roles, roleDO(&roles[j]))
		}
		out = append(out, item)
	}
	return out
}
func adminUserPO(v *biz.ManagedAdminUser) *model.AdminUser {
	return &model.AdminUser{Username: v.Username, DisplayName: v.DisplayName, Email: v.Email, PasswordHash: v.PasswordHash, Status: v.Status, PasswordChangedAt: time.Now().UTC()}
}
func adminUserDO(v *model.AdminUser) *biz.ManagedAdminUser {
	return &biz.ManagedAdminUser{ID: v.ID, Username: v.Username, DisplayName: v.DisplayName, Email: v.Email, Status: v.Status, FailedLoginCount: v.FailedLoginCount, LockedUntil: v.LockedUntil, LastLoginAt: v.LastLoginAt, Roles: []*biz.AdminRole{}, CreatedAt: v.CreatedAt, UpdatedAt: v.UpdatedAt}
}
func mapAdminUserError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return biz.ErrAdminUserNotFound
	}
	return err
}
