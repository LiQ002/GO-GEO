package data

import (
	"context"

	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/data/model"

	"gorm.io/gorm"
)

type adminAuthorizationRepo struct{ data *Data }

func NewAdminAuthorizationRepo(data *Data) biz.AdminAuthorizationRepo {
	return &adminAuthorizationRepo{data: data}
}
func (r *adminAuthorizationRepo) HasPermission(ctx context.Context, userID uint64, permission string) (bool, error) {
	var count int64
	err := activeAdminPermissionQuery(r.data.DB(ctx), userID).
		Where("p.code IN ?", []string{"platform.all", permission}).
		Count(&count).Error
	return count > 0, err
}

func (r *adminAuthorizationRepo) DataScope(ctx context.Context, userID uint64) (int32, error) {
	var scopes []int32
	if err := activeAdminRoleQuery(r.data.DB(ctx), userID).Distinct("r.data_scope").Pluck("r.data_scope", &scopes).Error; err != nil {
		return 0, err
	}
	for _, scope := range scopes {
		if scope == model.AdminRoleDataScopeAll {
			return scope, nil
		}
	}
	for _, scope := range scopes {
		if scope == model.AdminRoleDataScopeAssigned {
			return scope, nil
		}
	}
	for _, scope := range scopes {
		if scope == model.AdminRoleDataScopeReadonly {
			return scope, nil
		}
	}
	return 0, nil
}

func activeAdminRoleQuery(db *gorm.DB, userID uint64) *gorm.DB {
	return db.Table(model.TableAdminRoles+" AS r").
		Joins("JOIN "+model.TableAdminRoleBindings+" AS b ON b.role_id = r.id AND b.admin_user_id = ?", userID).
		Where("r.deleted_at IS NULL AND r.status = ?", model.AdminRoleStatusActive)
}

func activeAdminPermissionQuery(db *gorm.DB, userID uint64) *gorm.DB {
	return db.Table(model.TableAdminPermissions+" AS p").
		Joins("JOIN "+model.TableAdminRolePermissions+" AS rp ON rp.permission_id = p.id").
		Joins("JOIN "+model.TableAdminRoleBindings+" AS b ON b.role_id = rp.role_id AND b.admin_user_id = ?", userID).
		Joins("JOIN "+model.TableAdminRoles+" AS r ON r.id = b.role_id AND r.deleted_at IS NULL AND r.status = ?", model.AdminRoleStatusActive)
}
