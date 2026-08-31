package data

import (
	"context"
	"errors"
	"gorm.io/gorm"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/data/model"
	"strconv"
)

type systemSettingRepo struct{ data *Data }

func NewSystemSettingRepo(data *Data) biz.SystemSettingRepo { return &systemSettingRepo{data: data} }
func (r *systemSettingRepo) Create(ctx context.Context, c biz.SystemSettingCommand) (*biz.SystemSetting, error) {
	v := settingPO(c.Setting)
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		if err := tx.Create(v).Error; err != nil {
			return err
		}
		return writeAdminAudit(ctx, tx, c.OperatorID, "system_setting.create", "system_setting", strconv.FormatUint(v.ID, 10), "success", c.Reason, nil, map[string]any{"namespace": v.Namespace, "key": v.Key, "sensitive": v.Sensitive})
	})
	if err != nil {
		return nil, mapSettingError(err)
	}
	return settingDO(v), nil
}
func (r *systemSettingRepo) Get(ctx context.Context, id uint64) (*biz.SystemSetting, error) {
	var v model.SystemSetting
	if err := r.data.DB(ctx).First(&v, id).Error; err != nil {
		return nil, mapSettingError(err)
	}
	return settingDO(&v), nil
}
func (r *systemSettingRepo) List(ctx context.Context, o biz.SystemSettingListOptions) ([]*biz.SystemSetting, int64, error) {
	db := r.data.DB(ctx).Model(&model.SystemSetting{})
	if o.Namespace != "" {
		db = db.Where("namespace = ?", o.Namespace)
	}
	if o.Keyword != "" {
		k := "%" + o.Keyword + "%"
		db = db.Where("key_name LIKE ? OR description LIKE ?", k, k)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var xs []model.SystemSetting
	if err := db.Order("namespace ASC, key_name ASC").Offset(o.Offset).Limit(o.Limit).Find(&xs).Error; err != nil {
		return nil, 0, err
	}
	out := make([]*biz.SystemSetting, 0, len(xs))
	for i := range xs {
		out = append(out, settingDO(&xs[i]))
	}
	return out, total, nil
}
func (r *systemSettingRepo) Update(ctx context.Context, c biz.SystemSettingCommand) (*biz.SystemSetting, error) {
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var before model.SystemSetting
		if err := tx.First(&before, c.Setting.ID).Error; err != nil {
			return err
		}
		updates := map[string]any{"namespace": c.Setting.Namespace, "key_name": c.Setting.Key, "value_json": jsonBytes(c.Setting.ValueJSON), "description": c.Setting.Description, "is_sensitive": c.Setting.Sensitive, "version": gorm.Expr("version + 1")}
		res := tx.Model(&model.SystemSetting{}).Where("id = ? AND version = ?", c.Setting.ID, c.Setting.Version).Updates(updates)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected != 1 {
			return biz.ErrSystemSettingConflict
		}
		return writeAdminAudit(ctx, tx, c.OperatorID, "system_setting.update", "system_setting", strconv.FormatUint(c.Setting.ID, 10), "success", c.Reason, map[string]any{"namespace": before.Namespace, "key": before.Key, "sensitive": before.Sensitive}, map[string]any{"namespace": c.Setting.Namespace, "key": c.Setting.Key, "sensitive": c.Setting.Sensitive})
	})
	if err != nil {
		return nil, mapSettingError(err)
	}
	return r.Get(ctx, c.Setting.ID)
}
func (r *systemSettingRepo) Delete(ctx context.Context, c biz.DeleteSystemSettingCommand) error {
	return mapSettingError(r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var before model.SystemSetting
		if err := tx.First(&before, c.ID).Error; err != nil {
			return err
		}
		res := tx.Where("id = ? AND version = ?", c.ID, c.Version).Delete(&model.SystemSetting{})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected != 1 {
			return biz.ErrSystemSettingConflict
		}
		return writeAdminAudit(ctx, tx, c.OperatorID, "system_setting.delete", "system_setting", strconv.FormatUint(c.ID, 10), "success", c.Reason, map[string]any{"namespace": before.Namespace, "key": before.Key}, nil)
	}))
}
func settingPO(v *biz.SystemSetting) *model.SystemSetting {
	return &model.SystemSetting{Namespace: v.Namespace, Key: v.Key, ValueJSON: jsonBytes(v.ValueJSON), Description: v.Description, Sensitive: v.Sensitive, Version: v.Version}
}
func settingDO(v *model.SystemSetting) *biz.SystemSetting {
	value := string(v.ValueJSON)
	if v.Sensitive {
		value = "\"***\""
	}
	return &biz.SystemSetting{ID: v.ID, Namespace: v.Namespace, Key: v.Key, ValueJSON: value, Description: v.Description, Sensitive: v.Sensitive, Version: v.Version, CreatedAt: v.CreatedAt, UpdatedAt: v.UpdatedAt}
}
func mapSettingError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return biz.ErrSystemSettingNotFound
	}
	return err
}
