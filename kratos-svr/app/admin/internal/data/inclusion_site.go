package data

import (
	"context"
	"errors"
	"gorm.io/gorm"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/data/model"
)

type inclusionSiteRepo struct{ data *Data }

func NewInclusionSiteRepo(data *Data) biz.InclusionSiteRepo { return &inclusionSiteRepo{data: data} }
func (r *inclusionSiteRepo) Create(ctx context.Context, i *biz.InclusionSite) (*biz.InclusionSite, error) {
	po := inclusionSitePO(i)
	if e := r.data.DB(ctx).Create(po).Error; e != nil {
		return nil, mapInclusionSiteError(e)
	}
	return inclusionSiteDO(po), nil
}
func (r *inclusionSiteRepo) Get(ctx context.Context, id uint64) (*biz.InclusionSite, error) {
	var po model.InclusionSite
	if e := r.data.DB(ctx).First(&po, id).Error; e != nil {
		return nil, mapInclusionSiteError(e)
	}
	return inclusionSiteDO(&po), nil
}
func (r *inclusionSiteRepo) List(ctx context.Context, o biz.InclusionSiteListOptions) ([]*biz.InclusionSite, int64, error) {
	db := r.data.DB(ctx).Model(&model.InclusionSite{})
	if o.Status != 0 {
		db = db.Where("status = ?", o.Status)
	}
	if o.Keyword != "" {
		k := "%" + o.Keyword + "%"
		db = db.Where("name LIKE ? OR code LIKE ?", k, k)
	}
	var total int64
	if e := db.Count(&total).Error; e != nil {
		return nil, 0, mapInclusionSiteError(e)
	}
	var rows []model.InclusionSite
	if e := db.Order("sort_order ASC, id DESC").Offset(o.Offset).Limit(o.Limit).Find(&rows).Error; e != nil {
		return nil, 0, mapInclusionSiteError(e)
	}
	items := make([]*biz.InclusionSite, 0, len(rows))
	for x := range rows {
		items = append(items, inclusionSiteDO(&rows[x]))
	}
	return items, total, nil
}
func (r *inclusionSiteRepo) Update(ctx context.Context, i *biz.InclusionSite) (*biz.InclusionSite, error) {
	u := map[string]any{"driver_type": i.DriverType, "name": i.Name, "entry_url": i.EntryURL, "icon": i.Icon, "status": i.Status, "authorization_type": i.AuthorizationType, "driver_version": i.DriverVersion, "maintenance_message": i.MaintenanceMessage, "sort_order": i.SortOrder, "version": gorm.Expr("version + 1")}
	res := r.data.DB(ctx).Model(&model.InclusionSite{}).Where("id = ? AND version = ?", i.ID, i.Version).Updates(u)
	if res.Error != nil {
		return nil, mapInclusionSiteError(res.Error)
	}
	if res.RowsAffected != 1 {
		return nil, biz.ErrInclusionSiteConflict
	}
	return r.Get(ctx, i.ID)
}
func (r *inclusionSiteRepo) Delete(ctx context.Context, id, version uint64) error {
	res := r.data.DB(ctx).Where("id = ? AND version = ?", id, version).Delete(&model.InclusionSite{})
	if res.Error != nil {
		return mapInclusionSiteError(res.Error)
	}
	if res.RowsAffected != 1 {
		return biz.ErrInclusionSiteConflict
	}
	return nil
}
func inclusionSitePO(i *biz.InclusionSite) *model.InclusionSite {
	return &model.InclusionSite{Code: i.Code, DriverType: i.DriverType, Name: i.Name, EntryURL: i.EntryURL, Icon: i.Icon, Status: i.Status, AuthorizationType: i.AuthorizationType, DriverVersion: i.DriverVersion, MaintenanceMessage: i.MaintenanceMessage, SortOrder: i.SortOrder, Version: 1}
}
func inclusionSiteDO(i *model.InclusionSite) *biz.InclusionSite {
	return &biz.InclusionSite{ID: i.ID, Code: i.Code, DriverType: i.DriverType, Name: i.Name, EntryURL: i.EntryURL, Icon: i.Icon, Status: i.Status, AuthorizationType: model.AuthorizationTypeClientLogin, DriverVersion: i.DriverVersion, MaintenanceMessage: i.MaintenanceMessage, SortOrder: i.SortOrder, Version: i.Version, CreatedAt: i.CreatedAt, UpdatedAt: i.UpdatedAt}
}
func mapInclusionSiteError(e error) error {
	if errors.Is(e, gorm.ErrRecordNotFound) {
		return biz.ErrInclusionSiteNotFound
	}
	if errors.Is(e, gorm.ErrDuplicatedKey) {
		return biz.ErrInclusionSiteConflict
	}
	return e
}
