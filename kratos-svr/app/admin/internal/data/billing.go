package data

import (
	"context"
	"errors"
	"strings"

	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/data/model"

	"gorm.io/gorm"
)

// --- SubscriptionOrderRepo ---

type subscriptionOrderRepo struct{ data *Data }

func NewSubscriptionOrderRepo(data *Data) biz.SubscriptionOrderRepo {
	return &subscriptionOrderRepo{data: data}
}

func (r *subscriptionOrderRepo) Create(ctx context.Context, item *biz.SubscriptionOrder) (*biz.SubscriptionOrder, error) {
	po := subscriptionOrderPO(item)
	if err := r.data.DB(ctx).Create(po).Error; err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			return nil, biz.ErrSubscriptionOrderConflict
		}
		return nil, err
	}
	return subscriptionOrderDO(po), nil
}

func (r *subscriptionOrderRepo) Get(ctx context.Context, id uint64) (*biz.SubscriptionOrder, error) {
	var po model.SubscriptionOrder
	if err := r.data.DB(ctx).First(&po, id).Error; err != nil {
		return nil, mapSubscriptionOrderError(err)
	}
	return subscriptionOrderDO(&po), nil
}

func (r *subscriptionOrderRepo) GetByOrderNo(ctx context.Context, orderNo string) (*biz.SubscriptionOrder, error) {
	var po model.SubscriptionOrder
	if err := r.data.DB(ctx).Where("order_no = ?", orderNo).First(&po).Error; err != nil {
		return nil, mapSubscriptionOrderError(err)
	}
	return subscriptionOrderDO(&po), nil
}

func (r *subscriptionOrderRepo) List(ctx context.Context, opts biz.SubscriptionOrderListOptions) ([]*biz.SubscriptionOrder, int64, error) {
	db := r.data.DB(ctx).Model(&model.SubscriptionOrder{})
	if opts.EnterpriseID != 0 {
		db = db.Where("enterprise_id = ?", opts.EnterpriseID)
	}
	if opts.OrderType != "" {
		db = db.Where("order_type = ?", opts.OrderType)
	}
	if opts.Status != "" {
		db = db.Where("status = ?", opts.Status)
	}
	if opts.Source != "" {
		db = db.Where("source = ?", opts.Source)
	}
	if kw := strings.TrimSpace(opts.Keyword); kw != "" {
		db = db.Where("order_no LIKE ?", "%"+kw+"%")
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []model.SubscriptionOrder
	if err := db.Order("id DESC").Offset(opts.Offset).Limit(opts.Limit).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	items := make([]*biz.SubscriptionOrder, 0, len(rows))
	for i := range rows {
		items = append(items, subscriptionOrderDO(&rows[i]))
	}
	return items, total, nil
}

func (r *subscriptionOrderRepo) Update(ctx context.Context, item *biz.SubscriptionOrder) (*biz.SubscriptionOrder, error) {
	po := subscriptionOrderPO(item)
	po.ID = item.ID
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var existing model.SubscriptionOrder
		if err := tx.First(&existing, item.ID).Error; err != nil {
			return mapSubscriptionOrderError(err)
		}
		return tx.Model(&existing).Select(
			"plan_id", "order_type", "cycle", "amount_minor_units", "currency",
			"credits_amount", "addon_quota_metric", "addon_quota_amount",
			"renew_from_subscription_id", "refund_reference_order_id",
			"points_before", "points_after", "status", "source",
			"paid_at", "approved_at", "approved_by", "remark",
		).Updates(po).Error
	})
	if err != nil {
		return nil, err
	}
	return r.Get(ctx, item.ID)
}

func subscriptionOrderPO(item *biz.SubscriptionOrder) *model.SubscriptionOrder {
	return &model.SubscriptionOrder{
		TenantModel:             model.TenantModel{EnterpriseID: item.EnterpriseID},
		OrderNo:                 item.OrderNo,
		PlanID:                  item.PlanID,
		OrderType:               item.OrderType,
		Cycle:                   item.Cycle,
		AmountMinorUnits:        item.AmountMinorUnits,
		Currency:                item.Currency,
		CreditsAmount:           item.CreditsAmount,
		AddonQuotaMetric:        item.AddonQuotaMetric,
		AddonQuotaAmount:        item.AddonQuotaAmount,
		RenewFromSubscriptionID: item.RenewFromSubscriptionID,
		RefundReferenceOrderID:  item.RefundReferenceOrderID,
		PointsBefore:            item.PointsBefore,
		PointsAfter:             item.PointsAfter,
		Status:                  item.Status,
		Source:                  item.Source,
		PaidAt:                  item.PaidAt,
		ApprovedAt:              item.ApprovedAt,
		ApprovedBy:              item.ApprovedBy,
		Remark:                  item.Remark,
	}
}

func subscriptionOrderDO(item *model.SubscriptionOrder) *biz.SubscriptionOrder {
	return &biz.SubscriptionOrder{
		ID:                      item.ID,
		OrderNo:                 item.OrderNo,
		EnterpriseID:            item.EnterpriseID,
		PlanID:                  item.PlanID,
		OrderType:               item.OrderType,
		Cycle:                   item.Cycle,
		AmountMinorUnits:        item.AmountMinorUnits,
		Currency:                item.Currency,
		CreditsAmount:           item.CreditsAmount,
		AddonQuotaMetric:        item.AddonQuotaMetric,
		AddonQuotaAmount:        item.AddonQuotaAmount,
		RenewFromSubscriptionID: item.RenewFromSubscriptionID,
		RefundReferenceOrderID:  item.RefundReferenceOrderID,
		PointsBefore:            item.PointsBefore,
		PointsAfter:             item.PointsAfter,
		Status:                  item.Status,
		Source:                  item.Source,
		PaidAt:                  item.PaidAt,
		ApprovedAt:              item.ApprovedAt,
		ApprovedBy:              item.ApprovedBy,
		Remark:                  item.Remark,
		CreatedAt:               item.CreatedAt,
		UpdatedAt:               item.UpdatedAt,
	}
}

func mapSubscriptionOrderError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return biz.ErrSubscriptionOrderNotFound
	}
	return err
}

// --- PointsBalanceRepo ---

type pointsBalanceRepo struct{ data *Data }

func NewPointsBalanceRepo(data *Data) biz.PointsBalanceRepo {
	return &pointsBalanceRepo{data: data}
}

func (r *pointsBalanceRepo) Get(ctx context.Context, enterpriseID uint64) (*biz.PointsBalance, error) {
	var po model.PointsBalance
	if err := r.data.DB(ctx).Where("enterprise_id = ?", enterpriseID).First(&po).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// 无记录视为零余额，便于调用方直接使用。
			return &biz.PointsBalance{EnterpriseID: enterpriseID}, nil
		}
		return nil, err
	}
	return pointsBalanceDO(&po), nil
}

func (r *pointsBalanceRepo) Upsert(ctx context.Context, item *biz.PointsBalance) (*biz.PointsBalance, error) {
	po := pointsBalancePO(item)
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var existing model.PointsBalance
		if err := tx.Where("enterprise_id = ?", item.EnterpriseID).First(&existing).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return tx.Create(po).Error
			}
			return err
		}
		po.ID = existing.ID
		return tx.Model(&existing).Updates(map[string]any{
			"balance": po.Balance, "frozen": po.Frozen, "version": gorm.Expr("version + 1"),
		}).Error
	})
	if err != nil {
		return nil, err
	}
	return r.Get(ctx, item.EnterpriseID)
}

func pointsBalancePO(item *biz.PointsBalance) *model.PointsBalance {
	return &model.PointsBalance{
		ID: item.ID, EnterpriseID: item.EnterpriseID,
		Balance: item.Balance, Frozen: item.Frozen, Version: item.Version,
	}
}

func pointsBalanceDO(item *model.PointsBalance) *biz.PointsBalance {
	return &biz.PointsBalance{
		ID: item.ID, EnterpriseID: item.EnterpriseID,
		Balance: item.Balance, Frozen: item.Frozen, Version: item.Version,
		CreatedAt: item.CreatedAt, UpdatedAt: item.UpdatedAt,
	}
}

// --- PointsLedgerRepo ---

type pointsLedgerRepo struct{ data *Data }

func NewPointsLedgerRepo(data *Data) biz.PointsLedgerRepo {
	return &pointsLedgerRepo{data: data}
}

func (r *pointsLedgerRepo) Create(ctx context.Context, item *biz.PointsLedger) (*biz.PointsLedger, error) {
	po := pointsLedgerPO(item)
	if err := r.data.DB(ctx).Create(po).Error; err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			// 幂等键重复：已处理过，返回已有记录。
			var existing model.PointsLedger
			if err := r.data.DB(ctx).Where("idempotency_key = ?", item.IdempotencyKey).First(&existing).Error; err == nil {
				return pointsLedgerDO(&existing), nil
			}
		}
		return nil, err
	}
	return pointsLedgerDO(po), nil
}

func (r *pointsLedgerRepo) List(ctx context.Context, enterpriseID uint64, offset, limit int) ([]*biz.PointsLedger, int64, error) {
	db := r.data.DB(ctx).Model(&model.PointsLedger{}).Where("enterprise_id = ?", enterpriseID)
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []model.PointsLedger
	if err := db.Order("id DESC").Offset(offset).Limit(limit).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	items := make([]*biz.PointsLedger, 0, len(rows))
	for i := range rows {
		items = append(items, pointsLedgerDO(&rows[i]))
	}
	return items, total, nil
}

func pointsLedgerPO(item *biz.PointsLedger) *model.PointsLedger {
	return &model.PointsLedger{
		ImmutableTenantModel: model.ImmutableTenantModel{EnterpriseID: item.EnterpriseID},
		Operation:            item.Operation,
		Amount:               item.Amount,
		BalanceAfter:         item.BalanceAfter,
		FrozenAfter:          item.FrozenAfter,
		ReferenceType:        item.ReferenceType,
		ReferenceID:          item.ReferenceID,
		Reason:               item.Reason,
		OperatorID:           item.OperatorID,
		IdempotencyKey:       item.IdempotencyKey,
	}
}

func pointsLedgerDO(item *model.PointsLedger) *biz.PointsLedger {
	return &biz.PointsLedger{
		ID:             item.ID,
		EnterpriseID:   item.EnterpriseID,
		Operation:      item.Operation,
		Amount:         item.Amount,
		BalanceAfter:   item.BalanceAfter,
		FrozenAfter:    item.FrozenAfter,
		ReferenceType:  item.ReferenceType,
		ReferenceID:    item.ReferenceID,
		Reason:         item.Reason,
		OperatorID:     item.OperatorID,
		IdempotencyKey: item.IdempotencyKey,
		CreatedAt:      item.CreatedAt,
	}
}
