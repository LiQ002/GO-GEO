package data

import (
	"context"
	"errors"

	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/data/model"

	"gorm.io/gorm"
)

// --- PurchasablePlanRepo ---

type purchasablePlanRepo struct{ data *Data }

func NewPurchasablePlanRepo(data *Data) biz.PurchasablePlanRepo {
	return &purchasablePlanRepo{data: data}
}

func (r *purchasablePlanRepo) ListPurchasable(ctx context.Context) ([]*biz.PurchasablePlan, error) {
	// PlanStatusActive = 1（见 admin biz platform_enums.go）。
	var plans []model.Plan
	if err := r.data.DB(ctx).
		Where("visible_to_enterprise = ? AND status = ?", true, 1).
		Order("sort_order ASC, id ASC").
		Find(&plans).Error; err != nil {
		return nil, err
	}
	if len(plans) == 0 {
		return []*biz.PurchasablePlan{}, nil
	}
	planIDs := make([]uint64, 0, len(plans))
	for i := range plans {
		planIDs = append(planIDs, plans[i].ID)
	}
	var limits []model.PlanLimit
	if err := r.data.DB(ctx).Where("plan_id IN ?", planIDs).Find(&limits).Error; err != nil {
		return nil, err
	}
	var features []model.PlanFeature
	if err := r.data.DB(ctx).Where("plan_id IN ?", planIDs).Find(&features).Error; err != nil {
		return nil, err
	}
	limitMap := make(map[uint64][]*biz.PlanLimitProjection, len(plans))
	for i := range limits {
		limitMap[limits[i].PlanID] = append(limitMap[limits[i].PlanID], &biz.PlanLimitProjection{
			Metric: limits[i].Metric, LimitValue: limits[i].LimitValue, Period: limits[i].Period,
		})
	}
	featureMap := make(map[uint64][]*biz.PlanFeatureProjection, len(plans))
	for i := range features {
		featureMap[features[i].PlanID] = append(featureMap[features[i].PlanID], &biz.PlanFeatureProjection{
			Feature: features[i].Feature, Enabled: features[i].Enabled,
		})
	}
	items := make([]*biz.PurchasablePlan, 0, len(plans))
	for i := range plans {
		p := &plans[i]
		items = append(items, &biz.PurchasablePlan{
			ID: p.ID, Code: p.Code, Name: p.Name, Description: p.Description,
			HalfYearlyPriceMinorUnits: p.HalfYearlyPriceMinorUnits, YearlyPriceMinorUnits: p.YearlyPriceMinorUnits,
			Currency: p.Currency, BillingCycle: p.BillingCycle, SeriesCode: p.SeriesCode,
			GrantedPoints: p.GrantedPoints, SortOrder: p.SortOrder,
			Limits:   limitMap[p.ID],
			Features: featureMap[p.ID],
		})
	}
	return items, nil
}

// --- UserSubscriptionOrderRepo ---

type userSubscriptionOrderRepo struct{ data *Data }

func NewUserSubscriptionOrderRepo(data *Data) biz.UserSubscriptionOrderRepo {
	return &userSubscriptionOrderRepo{data: data}
}

func (r *userSubscriptionOrderRepo) Create(ctx context.Context, item *biz.UserSubscriptionOrder) (*biz.UserSubscriptionOrder, error) {
	po := userSubscriptionOrderPO(item)
	if err := r.data.DB(ctx).Create(po).Error; err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			return nil, biz.ErrSubscriptionOrderConflict
		}
		return nil, err
	}
	return userSubscriptionOrderDO(po, item.PlanName), nil
}

func (r *userSubscriptionOrderRepo) List(ctx context.Context, opts biz.UserOrderListOptions) ([]*biz.UserSubscriptionOrder, int64, error) {
	db := r.data.DB(ctx).Model(&model.SubscriptionOrder{}).Where("enterprise_id = ?", opts.EnterpriseID)
	if opts.OrderType != "" {
		db = db.Where("order_type = ?", opts.OrderType)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []model.SubscriptionOrder
	if err := db.Order("id DESC").Offset(opts.Offset).Limit(opts.Limit).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	items := make([]*biz.UserSubscriptionOrder, 0, len(rows))
	for i := range rows {
		items = append(items, userSubscriptionOrderDO(&rows[i], ""))
	}
	planNames, err := r.loadPlanNames(ctx, items)
	if err != nil {
		return nil, 0, err
	}
	for _, item := range items {
		if item.PlanID != nil {
			item.PlanName = planNames[*item.PlanID]
		}
	}
	return items, total, nil
}

func (r *userSubscriptionOrderRepo) Get(ctx context.Context, enterpriseID, orderID uint64) (*biz.UserSubscriptionOrder, error) {
	var po model.SubscriptionOrder
	if err := r.data.DB(ctx).Where("enterprise_id = ? AND id = ?", enterpriseID, orderID).First(&po).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, biz.ErrSubscriptionOrderNotFound
		}
		return nil, err
	}
	order := userSubscriptionOrderDO(&po, "")
	if order.PlanID != nil && *order.PlanID != 0 {
		var plan model.Plan
		if err := r.data.DB(ctx).Select("name").Where("id = ?", *order.PlanID).First(&plan).Error; err == nil {
			order.PlanName = plan.Name
		}
	}
	return order, nil
}

func (r *userSubscriptionOrderRepo) loadPlanNames(ctx context.Context, orders []*biz.UserSubscriptionOrder) (map[uint64]string, error) {
	planIDs := make([]uint64, 0)
	for _, o := range orders {
		if o.PlanID != nil && *o.PlanID != 0 {
			planIDs = append(planIDs, *o.PlanID)
		}
	}
	if len(planIDs) == 0 {
		return nil, nil
	}
	var plans []model.Plan
	if err := r.data.DB(ctx).Select("id, name").Where("id IN ?", planIDs).Find(&plans).Error; err != nil {
		return nil, err
	}
	result := make(map[uint64]string, len(plans))
	for _, p := range plans {
		result[p.ID] = p.Name
	}
	return result, nil
}

func userSubscriptionOrderPO(item *biz.UserSubscriptionOrder) *model.SubscriptionOrder {
	return &model.SubscriptionOrder{
		TenantModel:      model.TenantModel{EnterpriseID: item.EnterpriseID},
		OrderNo:          item.OrderNo,
		PlanID:           item.PlanID,
		OrderType:        item.OrderType,
		Cycle:            item.Cycle,
		AmountMinorUnits: item.AmountMinorUnits,
		Currency:         item.Currency,
		CreditsAmount:    item.CreditsAmount,
		Status:           item.Status,
		Source:           item.Source,
		Remark:           item.Remark,
	}
}

func userSubscriptionOrderDO(item *model.SubscriptionOrder, planName string) *biz.UserSubscriptionOrder {
	return &biz.UserSubscriptionOrder{
		ID:               item.ID,
		OrderNo:          item.OrderNo,
		EnterpriseID:     item.EnterpriseID,
		PlanID:           item.PlanID,
		PlanName:         planName,
		OrderType:        item.OrderType,
		Cycle:            item.Cycle,
		AmountMinorUnits: item.AmountMinorUnits,
		Currency:         item.Currency,
		CreditsAmount:    item.CreditsAmount,
		Status:           item.Status,
		Source:           item.Source,
		Remark:           item.Remark,
		CreatedAt:        item.CreatedAt,
		UpdatedAt:        item.UpdatedAt,
	}
}

// --- UserPointsBalanceRepo ---

type userPointsBalanceRepo struct{ data *Data }

func NewUserPointsBalanceRepo(data *Data) biz.UserPointsBalanceRepo {
	return &userPointsBalanceRepo{data: data}
}

func (r *userPointsBalanceRepo) Get(ctx context.Context, enterpriseID uint64) (*biz.UserPointsBalance, error) {
	var po model.PointsBalance
	if err := r.data.DB(ctx).Where("enterprise_id = ?", enterpriseID).First(&po).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return &biz.UserPointsBalance{EnterpriseID: enterpriseID}, nil
		}
		return nil, err
	}
	return &biz.UserPointsBalance{EnterpriseID: po.EnterpriseID, Balance: po.Balance, Frozen: po.Frozen}, nil
}
