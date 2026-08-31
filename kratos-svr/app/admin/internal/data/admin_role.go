package data

import (
	"context"
	"errors"
	"gorm.io/gorm"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/data/model"
	"strconv"
)

type adminRoleRepo struct{ data *Data }

func NewAdminRoleRepo(data *Data) biz.AdminRoleRepo { return &adminRoleRepo{data: data} }
func (r *adminRoleRepo) Create(ctx context.Context, c biz.AdminRoleCommand) (*biz.AdminRole, error) {
	var id uint64
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		v := rolePO(c.Role)
		if err := tx.Create(v).Error; err != nil {
			return err
		}
		id = v.ID
		if err := replaceRolePermissions(tx, id, c.PermissionIDs); err != nil {
			return err
		}
		return writeAdminAudit(ctx, tx, c.OperatorID, "admin_role.create", "admin_role", strconv.FormatUint(id, 10), "success", c.Reason, nil, v)
	})
	if err != nil {
		return nil, mapAdminRoleError(err)
	}
	return r.Get(ctx, id)
}
func (r *adminRoleRepo) Get(ctx context.Context, id uint64) (*biz.AdminRole, error) {
	var v model.AdminRole
	if err := r.data.DB(ctx).First(&v, id).Error; err != nil {
		return nil, mapAdminRoleError(err)
	}
	return r.hydrate(ctx, []model.AdminRole{v})[0], nil
}
func (r *adminRoleRepo) List(ctx context.Context, o biz.AdminRoleListOptions) ([]*biz.AdminRole, int64, error) {
	db := r.data.DB(ctx).Model(&model.AdminRole{})
	if o.Status != 0 {
		db = db.Where("status = ?", o.Status)
	}
	if o.Keyword != "" {
		k := "%" + o.Keyword + "%"
		db = db.Where("name LIKE ? OR code LIKE ?", k, k)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var xs []model.AdminRole
	if err := db.Order("id ASC").Offset(o.Offset).Limit(o.Limit).Find(&xs).Error; err != nil {
		return nil, 0, err
	}
	return r.hydrate(ctx, xs), total, nil
}
func (r *adminRoleRepo) Update(ctx context.Context, c biz.AdminRoleCommand) (*biz.AdminRole, error) {
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var before model.AdminRole
		if err := tx.First(&before, c.Role.ID).Error; err != nil {
			return err
		}
		updates := map[string]any{"name": c.Role.Name, "description": c.Role.Description, "data_scope": c.Role.DataScope, "status": c.Role.Status}
		if err := tx.Model(&before).Updates(updates).Error; err != nil {
			return err
		}
		return writeAdminAudit(ctx, tx, c.OperatorID, "admin_role.update", "admin_role", strconv.FormatUint(c.Role.ID, 10), "success", c.Reason, before, updates)
	})
	if err != nil {
		return nil, mapAdminRoleError(err)
	}
	return r.Get(ctx, c.Role.ID)
}
func (r *adminRoleRepo) Delete(ctx context.Context, id, op uint64, reason string) error {
	return mapAdminRoleError(r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var count int64
		if err := tx.Model(&model.AdminRoleBinding{}).Where("role_id = ?", id).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return biz.ErrAdminRoleInvalid
		}
		var before model.AdminRole
		if err := tx.First(&before, id).Error; err != nil {
			return err
		}
		if err := tx.Where("role_id = ?", id).Delete(&model.AdminRolePermission{}).Error; err != nil {
			return err
		}
		if err := tx.Delete(&before).Error; err != nil {
			return err
		}
		return writeAdminAudit(ctx, tx, op, "admin_role.delete", "admin_role", strconv.FormatUint(id, 10), "success", reason, before, nil)
	}))
}
func (r *adminRoleRepo) ListPermissions(ctx context.Context, resource, keyword string) ([]*biz.AdminPermission, error) {
	db := r.data.DB(ctx).Model(&model.AdminPermission{})
	if resource != "" {
		db = db.Where("resource = ?", resource)
	}
	if keyword != "" {
		k := "%" + keyword + "%"
		db = db.Where("name LIKE ? OR code LIKE ?", k, k)
	}
	var xs []model.AdminPermission
	if err := db.Order("resource ASC, code ASC").Find(&xs).Error; err != nil {
		return nil, err
	}
	out := make([]*biz.AdminPermission, 0, len(xs))
	for i := range xs {
		out = append(out, permissionDO(&xs[i]))
	}
	return out, nil
}
func (r *adminRoleRepo) SetPermissions(ctx context.Context, id uint64, ids []uint64, op uint64, reason string) (*biz.AdminRole, error) {
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var role model.AdminRole
		if err := tx.First(&role, id).Error; err != nil {
			return err
		}
		if err := replaceRolePermissions(tx, id, ids); err != nil {
			return err
		}
		return writeAdminAudit(ctx, tx, op, "admin_role.permissions.set", "admin_role", strconv.FormatUint(id, 10), "success", reason, nil, map[string]any{"permission_ids": ids})
	})
	if err != nil {
		return nil, mapAdminRoleError(err)
	}
	return r.Get(ctx, id)
}
func replaceRolePermissions(tx *gorm.DB, id uint64, ids []uint64) error {
	if err := tx.Where("role_id = ?", id).Delete(&model.AdminRolePermission{}).Error; err != nil {
		return err
	}
	for _, pid := range ids {
		if err := tx.Create(&model.AdminRolePermission{RoleID: id, PermissionID: pid}).Error; err != nil {
			return err
		}
	}
	return nil
}
func (r *adminRoleRepo) hydrate(ctx context.Context, xs []model.AdminRole) []*biz.AdminRole {
	out := make([]*biz.AdminRole, 0, len(xs))
	for i := range xs {
		v := &xs[i]
		item := roleDO(v)
		var ps []model.AdminPermission
		r.data.DB(ctx).Table(model.TableAdminPermissions+" AS p").Select("p.*").Joins("JOIN "+model.TableAdminRolePermissions+" AS rp ON rp.permission_id=p.id").Where("rp.role_id = ?", v.ID).Find(&ps)
		for j := range ps {
			item.Permissions = append(item.Permissions, permissionDO(&ps[j]))
		}
		out = append(out, item)
	}
	return out
}
func rolePO(v *biz.AdminRole) *model.AdminRole {
	return &model.AdminRole{Code: v.Code, Name: v.Name, Description: v.Description, DataScope: v.DataScope, Status: v.Status}
}
func roleDO(v *model.AdminRole) *biz.AdminRole {
	return &biz.AdminRole{ID: v.ID, Code: v.Code, Name: v.Name, Description: v.Description, DataScope: v.DataScope, Status: v.Status, Permissions: []*biz.AdminPermission{}, CreatedAt: v.CreatedAt, UpdatedAt: v.UpdatedAt}
}
func permissionDO(v *model.AdminPermission) *biz.AdminPermission {
	return &biz.AdminPermission{ID: v.ID, Code: v.Code, Name: v.Name, Resource: v.Resource, Action: v.Action, Description: v.Description}
}
func mapAdminRoleError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return biz.ErrAdminRoleNotFound
	}
	return err
}
