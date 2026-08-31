package data

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/data/model"

	"gorm.io/gorm"
)

// billingTxRepo implements biz.BillingTxRepo with cross-table transactions.
type billingTxRepo struct {
	data *Data
}

func NewBillingTxRepo(data *Data) biz.BillingTxRepo {
	return &billingTxRepo{data: data}
}

// generateOrderNo 生成唯一订单号：年月日时分秒 + 微秒 + 随机后缀。
func generateOrderNo(prefix string) string {
	now := time.Now().UTC()
	return fmt.Sprintf("%s%s%06d", prefix, now.Format("20060102150405"), now.Nanosecond()/1000%1000000)
}

// billingCycleDuration 返回计费周期对应的时长。
// 半年付 = 180 天，年付 = 365 天（与前端 dayjs().add(180,'day') 保持一致）。
func billingCycleDuration(cycle string) time.Duration {
	if cycle == "half_yearly" {
		return 180 * 24 * time.Hour
	}
	return 365 * 24 * time.Hour
}

// beijingMidnight 将时间截断到当天北京时间 00:00:00（凌晨零点失效）。
// 北京时间 = UTC+8，所以北京凌晨零点 = UTC 前一天 16:00:00。
var beijingLoc = func() *time.Location {
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		return time.FixedZone("CST", 8*3600)
	}
	return loc
}()

func beijingMidnight(t time.Time) time.Time {
	bj := t.In(beijingLoc)
	return time.Date(bj.Year(), bj.Month(), bj.Day(), 0, 0, 0, 0, beijingLoc).UTC()
}

// ExecuteOpenPlan 开通套餐：创建 plan 订单 → 创建/替换订阅 → 种子化 quota → 发放赠送点数。
func (r *billingTxRepo) ExecuteOpenPlan(ctx context.Context, cmd biz.OpenPlanCommand) (*biz.SubscriptionOrder, error) {
	var result *model.SubscriptionOrder
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		// 读取套餐
		var plan model.Plan
		if err := tx.First(&plan, cmd.PlanID).Error; err != nil {
			return err
		}
		// 计算金额与周期（到期时间统一取到期日 00:00:00 UTC）
		var amount int64
		if cmd.Cycle == "half_yearly" {
			amount = plan.HalfYearlyPriceMinorUnits
		} else {
			amount = plan.YearlyPriceMinorUnits
		}
		cycleDuration := billingCycleDuration(cmd.Cycle)
		now := time.Now().UTC()
		// 创建订单
		order := &model.SubscriptionOrder{
			TenantModel:      model.TenantModel{EnterpriseID: cmd.EnterpriseID},
			OrderNo:          generateOrderNo("PL"),
			PlanID:           &cmd.PlanID,
			OrderType:        biz.OrderTypePlan,
			Cycle:            cmd.Cycle,
			AmountMinorUnits: amount,
			Currency:         plan.Currency,
			Status:           biz.OrderStatusApproved,
			Source:           cmd.Source,
			ApprovedAt:       &now,
			ApprovedBy:       &cmd.OperatorID,
			Remark:           cmd.Remark,
		}
		if err := tx.Create(order).Error; err != nil {
			if errors.Is(err, gorm.ErrDuplicatedKey) {
				return biz.ErrSubscriptionOrderConflict
			}
			return err
		}
		// 替换旧订阅（置为 replaced）
		var oldSub model.Subscription
		if err := tx.Where("enterprise_id = ? AND status = ?", cmd.EnterpriseID, "active").Order("id DESC").First(&oldSub).Error; err == nil {
			if err := tx.Model(&oldSub).Update("status", "replaced").Error; err != nil {
				return err
			}
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		// 创建新订阅
		sub := &model.Subscription{
			TenantModel:        model.TenantModel{EnterpriseID: cmd.EnterpriseID},
			PlanID:             cmd.PlanID,
			ActivatedOrderID:   &order.ID,
			Status:             "active",
			StartsAt:           now,
			ExpiresAt:          beijingMidnight(now.Add(cycleDuration)),
			ExpiredAtProcessed: false,
			Version:            1,
		}
		if err := tx.Create(sub).Error; err != nil {
			return err
		}
		// 种子化 quota_limits
		if err := seedQuotaLimitsFromPlan(tx, cmd.EnterpriseID, cmd.PlanID); err != nil {
			return err
		}
		// 发放赠送点数
		if plan.GrantedPoints > 0 {
			if err := grantPoints(tx, cmd.EnterpriseID, plan.GrantedPoints, "subscription_order", order.ID, "套餐赠送点数", cmd.OperatorID); err != nil {
				return err
			}
			order.PointsBefore = nil // 由 grantPoints 内部填充
			order.PointsAfter = nil
		}
		// 审计日志
		if err := writeAdminAudit(ctx, tx, cmd.OperatorID, "billing.open_plan", "subscription_order", strconv.FormatUint(order.ID, 10), "success", cmd.Remark, nil, map[string]any{"enterprise_id": cmd.EnterpriseID, "plan_id": cmd.PlanID, "cycle": cmd.Cycle}); err != nil {
			return err
		}
		result = order
		return nil
	})
	if err != nil {
		return nil, err
	}
	return subscriptionOrderDO(result), nil
}

// ExecuteRenew 续费：创建 renew 订单 → 延长订阅 expires_at。
func (r *billingTxRepo) ExecuteRenew(ctx context.Context, cmd biz.RenewCommand) (*biz.SubscriptionOrder, error) {
	var result *model.SubscriptionOrder
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var plan model.Plan
		if err := tx.First(&plan, cmd.PlanID).Error; err != nil {
			return err
		}
		var amount int64
		if cmd.Cycle == "half_yearly" {
			amount = plan.HalfYearlyPriceMinorUnits
		} else {
			amount = plan.YearlyPriceMinorUnits
		}
		cycleDuration := billingCycleDuration(cmd.Cycle)
		now := time.Now().UTC()
		order := &model.SubscriptionOrder{
			TenantModel:             model.TenantModel{EnterpriseID: cmd.EnterpriseID},
			OrderNo:                 generateOrderNo("RN"),
			PlanID:                  &cmd.PlanID,
			OrderType:               biz.OrderTypeRenew,
			Cycle:                   cmd.Cycle,
			AmountMinorUnits:        amount,
			Currency:                plan.Currency,
			RenewFromSubscriptionID: cmd.RenewFromSubscriptionID,
			Status:                  biz.OrderStatusApproved,
			Source:                  cmd.Source,
			ApprovedAt:              &now,
			ApprovedBy:              &cmd.OperatorID,
			Remark:                  cmd.Remark,
		}
		if err := tx.Create(order).Error; err != nil {
			if errors.Is(err, gorm.ErrDuplicatedKey) {
				return biz.ErrSubscriptionOrderConflict
			}
			return err
		}
		// 找到当前活跃订阅并延长 expires_at
		var sub model.Subscription
		subQuery := tx.Where("enterprise_id = ? AND status = ?", cmd.EnterpriseID, "active").Order("id DESC")
		if cmd.RenewFromSubscriptionID != nil {
			subQuery = tx.Where("id = ?", *cmd.RenewFromSubscriptionID)
		}
		if err := subQuery.First(&sub).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return biz.ErrSubscriptionOrderConflict
			}
			return err
		}
		// 续费基准时间：如果尚未过期，从当前 expires_at 延长；如果已过期，从现在开始
		baseTime := sub.ExpiresAt
		if baseTime.Before(now) {
			baseTime = now
		}
		newExpires := beijingMidnight(baseTime.Add(cycleDuration))
		if err := tx.Model(&sub).Updates(map[string]any{
			"plan_id":              cmd.PlanID,
			"expires_at":           newExpires,
			"status":               "active",
			"auto_renew":           false,
			"expired_at_processed": false,
			"version":              gorm.Expr("version + 1"),
		}).Error; err != nil {
			return err
		}
		// 种子化 quota_limits（续费时重新写入额度）
		if err := seedQuotaLimitsFromPlan(tx, cmd.EnterpriseID, cmd.PlanID); err != nil {
			return err
		}
		if err := writeAdminAudit(ctx, tx, cmd.OperatorID, "billing.renew", "subscription_order", strconv.FormatUint(order.ID, 10), "success", cmd.Remark, nil, map[string]any{"enterprise_id": cmd.EnterpriseID, "subscription_id": sub.ID, "new_expires_at": newExpires}); err != nil {
			return err
		}
		result = order
		return nil
	})
	if err != nil {
		return nil, err
	}
	return subscriptionOrderDO(result), nil
}

// ExecuteAddon 加购额度：创建 addon 订单 → 增加 quota_limits.limit_value。
func (r *billingTxRepo) ExecuteAddon(ctx context.Context, cmd biz.AddonCommand) (*biz.SubscriptionOrder, error) {
	var result *model.SubscriptionOrder
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		now := time.Now().UTC()
		amount := cmd.AddonQuotaAmount
		order := &model.SubscriptionOrder{
			TenantModel:      model.TenantModel{EnterpriseID: cmd.EnterpriseID},
			OrderNo:          generateOrderNo("AD"),
			OrderType:        biz.OrderTypeAddon,
			AmountMinorUnits: cmd.AmountMinorUnits,
			Currency:         "CNY",
			AddonQuotaMetric: cmd.AddonQuotaMetric,
			AddonQuotaAmount: &amount,
			Status:           biz.OrderStatusApproved,
			Source:           cmd.Source,
			ApprovedAt:       &now,
			ApprovedBy:       &cmd.OperatorID,
			Remark:           cmd.Remark,
		}
		if err := tx.Create(order).Error; err != nil {
			if errors.Is(err, gorm.ErrDuplicatedKey) {
				return biz.ErrSubscriptionOrderConflict
			}
			return err
		}
		// 增加 quota_limits.limit_value
		var quota model.QuotaLimit
		if err := tx.Where("enterprise_id = ? AND metric = ?", cmd.EnterpriseID, cmd.AddonQuotaMetric).First(&quota).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				// 不存在则创建
				quota = model.QuotaLimit{
					TenantModel: model.TenantModel{EnterpriseID: cmd.EnterpriseID},
					Metric:      cmd.AddonQuotaMetric,
					LimitValue:  amount,
					Period:      "yearly",
				}
				if err := tx.Create(&quota).Error; err != nil {
					return err
				}
			} else {
				return err
			}
		} else {
			if err := tx.Model(&quota).Update("limit_value", gorm.Expr("limit_value + ?", amount)).Error; err != nil {
				return err
			}
		}
		if err := writeAdminAudit(ctx, tx, cmd.OperatorID, "billing.addon", "subscription_order", strconv.FormatUint(order.ID, 10), "success", cmd.Remark, nil, map[string]any{"enterprise_id": cmd.EnterpriseID, "metric": cmd.AddonQuotaMetric, "amount": amount}); err != nil {
			return err
		}
		result = order
		return nil
	})
	if err != nil {
		return nil, err
	}
	return subscriptionOrderDO(result), nil
}

// ExecuteRecharge 充值点数：创建 credits 订单 → 增加 balance → 写 recharge 流水。
func (r *billingTxRepo) ExecuteRecharge(ctx context.Context, cmd biz.RechargeCommand) (*biz.SubscriptionOrder, error) {
	var result *model.SubscriptionOrder
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		now := time.Now().UTC()
		credits := cmd.CreditsAmount
		order := &model.SubscriptionOrder{
			TenantModel:      model.TenantModel{EnterpriseID: cmd.EnterpriseID},
			OrderNo:          generateOrderNo("CR"),
			OrderType:        biz.OrderTypeCredits,
			AmountMinorUnits: cmd.AmountMinorUnits,
			Currency:         "CNY",
			CreditsAmount:    &credits,
			Status:           biz.OrderStatusApproved,
			Source:           cmd.Source,
			ApprovedAt:       &now,
			ApprovedBy:       &cmd.OperatorID,
			Remark:           cmd.Remark,
		}
		if err := tx.Create(order).Error; err != nil {
			if errors.Is(err, gorm.ErrDuplicatedKey) {
				return biz.ErrSubscriptionOrderConflict
			}
			return err
		}
		// 增加点数余额并写流水
		balanceBefore, balanceAfter, err := addPoints(tx, cmd.EnterpriseID, credits, "subscription_order", order.ID, "充值点数", cmd.OperatorID)
		if err != nil {
			return err
		}
		order.PointsBefore = &balanceBefore
		order.PointsAfter = &balanceAfter
		if err := tx.Model(order).Select("points_before", "points_after").Updates(map[string]any{"points_before": balanceBefore, "points_after": balanceAfter}).Error; err != nil {
			return err
		}
		if err := writeAdminAudit(ctx, tx, cmd.OperatorID, "billing.recharge", "subscription_order", strconv.FormatUint(order.ID, 10), "success", cmd.Remark, nil, map[string]any{"enterprise_id": cmd.EnterpriseID, "credits": credits}); err != nil {
			return err
		}
		result = order
		return nil
	})
	if err != nil {
		return nil, err
	}
	return subscriptionOrderDO(result), nil
}

// ExecuteRefund 退款：创建 refund 订单 → 扣减点数/额度 → 写 refund 流水。
func (r *billingTxRepo) ExecuteRefund(ctx context.Context, cmd biz.RefundCommand) (*biz.SubscriptionOrder, error) {
	var result *model.SubscriptionOrder
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		// 读取原订单
		var ref model.SubscriptionOrder
		if err := tx.First(&ref, cmd.RefundReferenceOrderID).Error; err != nil {
			return biz.ErrSubscriptionOrderNotFound
		}
		now := time.Now().UTC()
		refID := cmd.RefundReferenceOrderID
		order := &model.SubscriptionOrder{
			TenantModel:            model.TenantModel{EnterpriseID: ref.EnterpriseID},
			OrderNo:                generateOrderNo("RF"),
			OrderType:              biz.OrderTypeRefund,
			AmountMinorUnits:       -ref.AmountMinorUnits,
			Currency:               ref.Currency,
			RefundReferenceOrderID: &refID,
			Status:                 biz.OrderStatusRefunded,
			Source:                 biz.OrderSourceAdminGrant,
			ApprovedAt:             &now,
			ApprovedBy:             &cmd.OperatorID,
			Remark:                 cmd.Remark,
		}
		if err := tx.Create(order).Error; err != nil {
			if errors.Is(err, gorm.ErrDuplicatedKey) {
				return biz.ErrSubscriptionOrderConflict
			}
			return err
		}
		// 标记原订单为 refunded
		if err := tx.Model(&ref).Update("status", biz.OrderStatusRefunded).Error; err != nil {
			return err
		}
		// 根据原订单类型回滚副作用
		switch ref.OrderType {
		case biz.OrderTypeCredits:
			if ref.CreditsAmount != nil && *ref.CreditsAmount > 0 {
				// 扣减点数
				if _, _, err := addPoints(tx, ref.EnterpriseID, -*ref.CreditsAmount, "subscription_order", order.ID, "退款扣减点数", cmd.OperatorID); err != nil {
					return err
				}
			}
		case biz.OrderTypeAddon:
			if ref.AddonQuotaMetric != "" && ref.AddonQuotaAmount != nil && *ref.AddonQuotaAmount > 0 {
				// 扣减额度
				if err := tx.Model(&model.QuotaLimit{}).
					Where("enterprise_id = ? AND metric = ?", ref.EnterpriseID, ref.AddonQuotaMetric).
					Update("limit_value", gorm.Expr("GREATEST(limit_value - ?, 0)", *ref.AddonQuotaAmount)).Error; err != nil {
					return err
				}
			}
		}
		if err := writeAdminAudit(ctx, tx, cmd.OperatorID, "billing.refund", "subscription_order", strconv.FormatUint(order.ID, 10), "success", cmd.Remark, nil, map[string]any{"refund_reference_order_id": cmd.RefundReferenceOrderID}); err != nil {
			return err
		}
		result = order
		return nil
	})
	if err != nil {
		return nil, err
	}
	return subscriptionOrderDO(result), nil
}

// grantPoints 在事务内发放赠送点数（balance += amount，写 grant 流水）。
func grantPoints(tx *gorm.DB, enterpriseID uint64, amount int64, referenceType string, referenceID uint64, reason string, operatorID uint64) error {
	var existing model.PointsBalance
	if err := tx.Where("enterprise_id = ?", enterpriseID).First(&existing).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			pb := &model.PointsBalance{
				EnterpriseID: enterpriseID,
				Balance:      amount,
				Version:      1,
			}
			if err := tx.Create(pb).Error; err != nil {
				return err
			}
		} else {
			return err
		}
	} else {
		if err := tx.Model(&existing).Updates(map[string]any{
			"balance": gorm.Expr("balance + ?", amount),
			"version": gorm.Expr("version + 1"),
		}).Error; err != nil {
			return err
		}
	}
	// 读取最新余额用于流水记录
	var pb model.PointsBalance
	if err := tx.Where("enterprise_id = ?", enterpriseID).First(&pb).Error; err != nil {
		return err
	}
	ledger := &model.PointsLedger{
		ImmutableTenantModel: model.ImmutableTenantModel{EnterpriseID: enterpriseID},
		Operation:            biz.PointsOperationGrant,
		Amount:               amount,
		BalanceAfter:         pb.Balance,
		FrozenAfter:          pb.Frozen,
		ReferenceType:        referenceType,
		ReferenceID:          &referenceID,
		Reason:               reason,
		OperatorID:           &operatorID,
		IdempotencyKey:       fmt.Sprintf("%s-grant:%d", referenceType, referenceID),
	}
	return tx.Create(ledger).Error
}

// addPoints 在事务内增减点数余额并写流水，返回 before/after 余额。
func addPoints(tx *gorm.DB, enterpriseID uint64, amount int64, referenceType string, referenceID uint64, reason string, operatorID uint64) (int64, int64, error) {
	var existing model.PointsBalance
	var balanceBefore int64
	if err := tx.Where("enterprise_id = ?", enterpriseID).First(&existing).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if amount < 0 {
				return 0, 0, biz.ErrPointsInsufficient
			}
			balanceBefore = 0
			pb := &model.PointsBalance{
				EnterpriseID: enterpriseID,
				Balance:      amount,
				Version:      1,
			}
			if err := tx.Create(pb).Error; err != nil {
				return 0, 0, err
			}
		} else {
			return 0, 0, err
		}
	} else {
		balanceBefore = existing.Balance
		if existing.Balance+amount < 0 {
			return 0, 0, biz.ErrPointsInsufficient
		}
		if err := tx.Model(&existing).Updates(map[string]any{
			"balance": gorm.Expr("balance + ?", amount),
			"version": gorm.Expr("version + 1"),
		}).Error; err != nil {
			return 0, 0, err
		}
	}
	// 读取最新余额
	var pb model.PointsBalance
	if err := tx.Where("enterprise_id = ?", enterpriseID).First(&pb).Error; err != nil {
		return 0, 0, err
	}
	operation := biz.PointsOperationRecharge
	if amount < 0 {
		operation = biz.PointsOperationRefund
	}
	ledger := &model.PointsLedger{
		ImmutableTenantModel: model.ImmutableTenantModel{EnterpriseID: enterpriseID},
		Operation:            operation,
		Amount:               amount,
		BalanceAfter:         pb.Balance,
		FrozenAfter:          pb.Frozen,
		ReferenceType:        referenceType,
		ReferenceID:          &referenceID,
		Reason:               reason,
		OperatorID:           &operatorID,
		IdempotencyKey:       fmt.Sprintf("%s-adjust:%d", referenceType, referenceID),
	}
	if err := tx.Create(ledger).Error; err != nil {
		return 0, 0, err
	}
	return balanceBefore, pb.Balance, nil
}
