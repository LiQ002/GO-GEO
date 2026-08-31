package data

import (
	"context"
	stderrors "errors"
	"fmt"
	"gorm.io/gorm"
	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/data/model"
)

type brandRepo struct{ data *Data }

func NewBrandRepo(d *Data) biz.BrandRepo { return &brandRepo{data: d} }
func (r *brandRepo) Create(c context.Context, i *biz.Brand) (*biz.Brand, error) {
	var po *model.Brand
	x := r.data.WithinTransaction(c, func(tx *gorm.DB) error {
		// 校验品牌词配额（brand_keywords），超出则拒绝创建
		if e := reserveQuota(tx, i.EnterpriseID, "brand_keywords", 1); e != nil {
			return e
		}
		p := brandPO(i)
		if e := tx.Create(p).Error; e != nil {
			return e
		}
		po = p
		// 创建成功后立即结算（同步操作：预留 → 已用）
		return settleQuota(tx, i.EnterpriseID, "brand_keywords", 1, "brand", p.ID, fmt.Sprintf("brand-create-%d", p.ID))
	})
	if x != nil {
		return nil, mapBrandError(x)
	}
	return brandDO(po), nil
}
func (r *brandRepo) Get(c context.Context, e, id uint64) (*biz.Brand, error) {
	var p model.Brand
	if x := r.data.DB(c).Where("enterprise_id = ? AND id = ?", e, id).First(&p).Error; x != nil {
		return nil, mapBrandError(x)
	}
	return brandDO(&p), nil
}
func (r *brandRepo) List(c context.Context, e uint64, o biz.BrandListOptions) ([]*biz.Brand, int64, error) {
	db := r.data.DB(c).Model(&model.Brand{}).Where("enterprise_id = ?", e)
	if o.Status != 0 {
		db = db.Where("status = ?", o.Status)
	}
	if o.Keyword != "" {
		k := "%" + o.Keyword + "%"
		db = db.Where("name LIKE ?", k)
	}
	var total int64
	if x := db.Count(&total).Error; x != nil {
		return nil, 0, x
	}
	var rows []model.Brand
	if x := db.Order("created_at DESC, id DESC").Offset(o.Offset).Limit(o.Limit).Find(&rows).Error; x != nil {
		return nil, 0, x
	}
	out := make([]*biz.Brand, 0, len(rows))
	for j := range rows {
		out = append(out, brandDO(&rows[j]))
	}
	return out, total, nil
}
func (r *brandRepo) Update(c context.Context, i *biz.Brand) (*biz.Brand, error) {
	u := map[string]any{"name": i.Name, "aliases_json": jsonBytes(i.AliasesJSON), "official_domain": i.OfficialDomain, "description": i.Description, "industry": i.Industry, "region": i.Region, "target_audience": i.TargetAudience, "core_value": i.CoreValue, "status": i.Status, "version": gorm.Expr("version + 1")}
	res := r.data.DB(c).Model(&model.Brand{}).Where("enterprise_id = ? AND id = ? AND version = ?", i.EnterpriseID, i.ID, i.Version).Updates(u)
	if res.Error != nil {
		return nil, mapBrandError(res.Error)
	}
	if res.RowsAffected != 1 {
		return nil, biz.ErrBrandConflict
	}
	return r.Get(c, i.EnterpriseID, i.ID)
}
func (r *brandRepo) Delete(c context.Context, e, id, v uint64) error {
	x := r.data.WithinTransaction(c, func(tx *gorm.DB) error {
		res := tx.Where("enterprise_id = ? AND id = ? AND version = ?", e, id, v).Delete(&model.Brand{})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected != 1 {
			return biz.ErrBrandConflict
		}
		// 释放品牌词配额（used_value -= 1）
		return releaseUsedQuota(tx, e, "brand_keywords", 1, "brand", id, fmt.Sprintf("brand-delete-%d", id))
	})
	if x != nil {
		return mapBrandError(x)
	}
	return nil
}
func brandPO(i *biz.Brand) *model.Brand {
	return &model.Brand{TenantModel: model.TenantModel{EnterpriseID: i.EnterpriseID}, Name: i.Name, AliasesJSON: jsonBytes(i.AliasesJSON), OfficialDomain: i.OfficialDomain, Description: i.Description, Industry: i.Industry, Region: i.Region, TargetAudience: i.TargetAudience, CoreValue: i.CoreValue, Status: i.Status, Version: 1}
}
func brandDO(i *model.Brand) *biz.Brand {
	return &biz.Brand{ID: i.ID, EnterpriseID: i.EnterpriseID, Name: i.Name, AliasesJSON: string(i.AliasesJSON), OfficialDomain: i.OfficialDomain, Description: i.Description, Industry: i.Industry, Region: i.Region, TargetAudience: i.TargetAudience, CoreValue: i.CoreValue, Status: i.Status, Version: i.Version, CreatedAt: i.CreatedAt, UpdatedAt: i.UpdatedAt}
}
func mapBrandError(e error) error {
	if stderrors.Is(e, gorm.ErrRecordNotFound) {
		return biz.ErrBrandNotFound
	}
	if stderrors.Is(e, gorm.ErrDuplicatedKey) {
		return biz.ErrBrandConflict
	}
	if stderrors.Is(e, biz.ErrPublishQuota) {
		return biz.ErrBrandKeywordQuotaExceeded
	}
	return e
}
