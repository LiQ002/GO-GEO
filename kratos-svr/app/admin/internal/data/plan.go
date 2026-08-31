package data

import (
	"context"
	"errors"
	"fmt"
	"time"

	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/data/model"

	"gorm.io/gorm"
)

type planRepo struct{ data *Data }

func NewPlanRepo(data *Data) biz.PlanRepo { return &planRepo{data: data} }

func (r *planRepo) Create(ctx context.Context, item *biz.Plan) (*biz.Plan, error) {
	var planID uint64
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		po := planPO(item)
		if err := tx.Create(po).Error; err != nil {
			return err
		}
		planID = po.ID
		return replacePlanConfiguration(tx, po.ID, item)
	})
	if err != nil {
		return nil, mapPlanError(err)
	}
	return r.Get(ctx, planID)
}

func (r *planRepo) Get(ctx context.Context, id uint64) (*biz.Plan, error) {
	var po model.Plan
	if err := r.data.DB(ctx).First(&po, id).Error; err != nil {
		return nil, mapPlanError(err)
	}
	items, err := r.hydrate(ctx, []model.Plan{po})
	if err != nil {
		return nil, err
	}
	return items[0], nil
}

func (r *planRepo) List(ctx context.Context, opts biz.PlanListOptions) ([]*biz.Plan, int64, error) {
	db := r.data.DB(ctx).Model(&model.Plan{})
	if opts.Status != 0 {
		db = db.Where("status = ?", opts.Status)
	}
	if opts.Keyword != "" {
		keyword := "%" + opts.Keyword + "%"
		db = db.Where("name LIKE ? OR code LIKE ?", keyword, keyword)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, mapPlanError(err)
	}
	var records []model.Plan
	if err := db.Order("id DESC").Offset(opts.Offset).Limit(opts.Limit).Find(&records).Error; err != nil {
		return nil, 0, mapPlanError(err)
	}
	items, err := r.hydrate(ctx, records)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *planRepo) Update(ctx context.Context, item *biz.Plan) (*biz.Plan, error) {
	// 读取旧的 granted_points 用于计算赠送点数增量
	var oldPlan model.Plan
	if err := r.data.DB(ctx).First(&oldPlan, item.ID).Error; err != nil {
		return nil, mapPlanError(err)
	}

	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		result := tx.Model(&model.Plan{}).Where("id = ?", item.ID).Updates(map[string]any{
			"name":                          item.Name,
			"status":                        item.Status,
			"description":                   item.Description,
			"half_yearly_price_minor_units": item.HalfYearlyPriceMinorUnits,
			"yearly_price_minor_units":      item.YearlyPriceMinorUnits,
			"currency":                      item.Currency,
			"billing_cycle":                 item.BillingCycle,
			"visible_to_enterprise":         item.VisibleToEnterprise,
			"sort_order":                    item.SortOrder,
			"series_code":                   item.SeriesCode,
			"granted_points":                item.GrantedPoints,
		})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return biz.ErrPlanNotFound
		}
		if err := replacePlanConfiguration(tx, item.ID, item); err != nil {
			return err
		}
		// 同步更新所有绑定该套餐的企业配额
		if err := syncQuotasForAllEnterprises(tx, item.ID); err != nil {
			return err
		}
		// 同步赠送点数增量：如果 granted_points 增加，给所有活跃订阅企业发放差额
		if item.GrantedPoints > oldPlan.GrantedPoints {
			delta := item.GrantedPoints - oldPlan.GrantedPoints
			if err := syncGrantedPointsForAllEnterprises(tx, item.ID, delta); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, mapPlanError(err)
	}
	return r.Get(ctx, item.ID)
}

// syncGrantedPointsForAllEnterprises 套餐赠送点数增加时，给所有活跃订阅企业发放增量点数。
// delta 为正数（已在调用方校验），通过 grantPoints 发放并写流水。
func syncGrantedPointsForAllEnterprises(tx *gorm.DB, planID uint64, delta int64) error {
	var subscriptions []model.Subscription
	if err := tx.Where("plan_id = ? AND status = ?", planID, "active").Find(&subscriptions).Error; err != nil {
		return err
	}
	for _, sub := range subscriptions {
		if err := grantPoints(tx, sub.EnterpriseID, delta, "plan_grant_sync", planID,
			fmt.Sprintf("套餐(%d)赠送点数调整 +%d", planID, delta), 0); err != nil {
			return err
		}
	}
	return nil
}

// syncQuotasForAllEnterprises 套餐变更后，同步更新所有绑定该套餐且订阅有效的企业配额。
// 遍历所有 status=active 且 plan_id 匹配的订阅，逐个调用 seedQuotaLimitsFromPlan。
// 保留企业已使用配额（used_value/reserved_value），仅更新限额和周期配置。
func syncQuotasForAllEnterprises(tx *gorm.DB, planID uint64) error {
	var subscriptions []model.Subscription
	if err := tx.Where("plan_id = ? AND status = ?", planID, "active").Find(&subscriptions).Error; err != nil {
		return err
	}
	for _, sub := range subscriptions {
		if err := seedQuotaLimitsFromPlan(tx, sub.EnterpriseID, planID); err != nil {
			return err
		}
	}
	return nil
}

func (r *planRepo) Delete(ctx context.Context, id uint64) error {
	return mapPlanError(r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var references int64
		if err := tx.Model(&model.Subscription{}).Where("plan_id = ?", id).Count(&references).Error; err != nil {
			return err
		}
		if references > 0 {
			return biz.ErrPlanConflict
		}
		result := tx.Delete(&model.Plan{}, id)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return biz.ErrPlanNotFound
		}
		if err := tx.Where("plan_id = ?", id).Delete(&model.PlanLimit{}).Error; err != nil {
			return err
		}
		return tx.Where("plan_id = ?", id).Delete(&model.PlanFeature{}).Error
	}))
}

func planPO(item *biz.Plan) *model.Plan {
	return &model.Plan{
		Code: item.Code, Name: item.Name, Description: item.Description, Status: item.Status,
		HalfYearlyPriceMinorUnits: item.HalfYearlyPriceMinorUnits, YearlyPriceMinorUnits: item.YearlyPriceMinorUnits,
		Currency: item.Currency, BillingCycle: item.BillingCycle, VisibleToEnterprise: item.VisibleToEnterprise,
		SortOrder: item.SortOrder, SeriesCode: item.SeriesCode, GrantedPoints: item.GrantedPoints,
	}
}

func planDO(item *model.Plan) *biz.Plan {
	return &biz.Plan{
		ID: item.ID, Code: item.Code, Name: item.Name, Description: item.Description, Status: item.Status,
		HalfYearlyPriceMinorUnits: item.HalfYearlyPriceMinorUnits, YearlyPriceMinorUnits: item.YearlyPriceMinorUnits,
		Currency: item.Currency, BillingCycle: item.BillingCycle, VisibleToEnterprise: item.VisibleToEnterprise,
		SortOrder: item.SortOrder, SeriesCode: item.SeriesCode, GrantedPoints: item.GrantedPoints,
		Limits: make([]*biz.PlanLimit, 0), Features: make([]*biz.PlanFeature, 0),
		CreatedAt: item.CreatedAt, UpdatedAt: item.UpdatedAt,
	}
}

func (r *planRepo) hydrate(ctx context.Context, records []model.Plan) ([]*biz.Plan, error) {
	items := make([]*biz.Plan, 0, len(records))
	if len(records) == 0 {
		return items, nil
	}
	ids := make([]uint64, 0, len(records))
	byID := make(map[uint64]*biz.Plan, len(records))
	for i := range records {
		item := planDO(&records[i])
		ids = append(ids, item.ID)
		byID[item.ID] = item
		items = append(items, item)
	}
	var limits []model.PlanLimit
	if err := r.data.DB(ctx).Where("plan_id IN ?", ids).Order("plan_id ASC, id ASC").Find(&limits).Error; err != nil {
		return nil, mapPlanError(err)
	}
	for i := range limits {
		item := byID[limits[i].PlanID]
		item.Limits = append(item.Limits, planLimitDO(&limits[i]))
	}
	var features []model.PlanFeature
	if err := r.data.DB(ctx).Where("plan_id IN ?", ids).Order("plan_id ASC, id ASC").Find(&features).Error; err != nil {
		return nil, mapPlanError(err)
	}
	for i := range features {
		item := byID[features[i].PlanID]
		item.Features = append(item.Features, planFeatureDO(&features[i]))
	}
	return items, nil
}

func replacePlanConfiguration(tx *gorm.DB, planID uint64, item *biz.Plan) error {
	if err := tx.Where("plan_id = ?", planID).Delete(&model.PlanLimit{}).Error; err != nil {
		return err
	}
	if err := tx.Where("plan_id = ?", planID).Delete(&model.PlanFeature{}).Error; err != nil {
		return err
	}
	if len(item.Limits) > 0 {
		limits := make([]model.PlanLimit, 0, len(item.Limits))
		for _, limit := range item.Limits {
			limits = append(limits, model.PlanLimit{
				PlanID: planID, Metric: limit.Metric, LimitValue: limit.LimitValue, Period: limit.Period,
			})
		}
		if err := tx.Create(&limits).Error; err != nil {
			return err
		}
	}
	if len(item.Features) > 0 {
		// 用 map 代替 struct，避免 GORM 对 bool 零值（enabled=false）跳过写入，
		// 导致使用数据库 default:true，使关闭的功能开关被错误存为 enabled=true。
		now := time.Now().UTC()
		features := make([]map[string]any, 0, len(item.Features))
		for _, feature := range item.Features {
			features = append(features, map[string]any{
				"plan_id":    planID,
				"feature":    feature.Feature,
				"enabled":    feature.Enabled,
				"created_at": now,
				"updated_at": now,
			})
		}
		if err := tx.Table(model.TablePlanFeatures).Create(&features).Error; err != nil {
			return err
		}
	}
	return nil
}

func planLimitDO(item *model.PlanLimit) *biz.PlanLimit {
	return &biz.PlanLimit{
		ID: item.ID, PlanID: item.PlanID, Metric: item.Metric,
		LimitValue: item.LimitValue, Period: item.Period,
	}
}

func planFeatureDO(item *model.PlanFeature) *biz.PlanFeature {
	return &biz.PlanFeature{
		ID: item.ID, PlanID: item.PlanID, Feature: item.Feature, Enabled: item.Enabled,
	}
}

func mapPlanError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return biz.ErrPlanNotFound
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return biz.ErrPlanConflict
	}
	return err
}
