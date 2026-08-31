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

type enterpriseRepo struct{ data *Data }

func NewEnterpriseRepo(data *Data) biz.EnterpriseRepo { return &enterpriseRepo{data: data} }

func (r *enterpriseRepo) Create(ctx context.Context, cmd biz.CreateEnterpriseCommand) (*biz.EnterpriseDetail, error) {
	var enterpriseID uint64
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		enterprise := enterprisePO(cmd.Detail.Enterprise)
		if err := tx.Create(enterprise).Error; err != nil {
			return err
		}
		enterpriseID = enterprise.ID
		account := enterpriseAccountPO(cmd.Detail.Account)
		account.EnterpriseID = enterprise.ID
		if err := tx.Create(account).Error; err != nil {
			return err
		}
		if subscription := cmd.Detail.Subscription; subscription != nil {
			var plan model.Plan
			hasPlan := tx.First(&plan, subscription.PlanID).Error == nil
			po := subscriptionPO(subscription)
			po.EnterpriseID = enterprise.ID
			// 根据套餐计费周期自动推算到期时间（到期日北京时间 00:00:00 凌晨零点失效），
			// 忽略前端传入的手动到期时间。
			if hasPlan {
				po.ExpiresAt = beijingMidnight(po.StartsAt.Add(billingCycleDuration(plan.BillingCycle)))
			} else {
				po.ExpiresAt = beijingMidnight(po.ExpiresAt)
			}
			if err := tx.Create(po).Error; err != nil {
				return err
			}
			// 从套餐 seed 额度配置（与 SetSubscription 保持一致）
			if err := seedQuotaLimitsFromPlan(tx, enterprise.ID, subscription.PlanID); err != nil {
				return err
			}
			// 套餐自带的赠送点数自动发放
			if hasPlan && plan.GrantedPoints > 0 {
				if err := grantPoints(tx, enterprise.ID, plan.GrantedPoints, "subscription_order", 0, "套餐赠送点数", cmd.OperatorID); err != nil {
					return err
				}
			}
		}
		for _, quota := range cmd.Detail.Quotas {
			po := quotaPO(quota)
			po.EnterpriseID = enterprise.ID
			if err := tx.Create(po).Error; err != nil {
				return err
			}
		}
		// 额外赠送点数（在套餐自带点数之外）
		if cmd.GrantedPoints > 0 {
			if err := grantPoints(tx, enterprise.ID, cmd.GrantedPoints, "admin_grant", 0, "管理员开通企业时额外赠送", cmd.OperatorID); err != nil {
				return err
			}
		}
		return writeAdminAudit(ctx, tx, cmd.OperatorID, "enterprise.create", "enterprise", strconv.FormatUint(enterprise.ID, 10), "success", "", nil, enterprise)
	})
	if err != nil {
		return nil, mapEnterpriseError(err)
	}
	return r.Get(ctx, enterpriseID)
}

func (r *enterpriseRepo) Get(ctx context.Context, id uint64) (*biz.EnterpriseDetail, error) {
	var enterprise model.Enterprise
	if err := r.data.DB(ctx).First(&enterprise, id).Error; err != nil {
		return nil, mapEnterpriseError(err)
	}
	items, err := r.hydrate(ctx, []model.Enterprise{enterprise})
	if err != nil {
		return nil, err
	}
	return items[0], nil
}

func (r *enterpriseRepo) List(ctx context.Context, opts biz.EnterpriseListOptions) ([]*biz.EnterpriseDetail, int64, error) {
	db := r.data.DB(ctx).Model(&model.Enterprise{})
	if opts.Keyword != "" {
		keyword := "%" + opts.Keyword + "%"
		db = db.Where("name LIKE ? OR code LIKE ? OR contact_name LIKE ? OR contact_phone LIKE ?", keyword, keyword, keyword, keyword)
	}
	if opts.Status != "" {
		db = db.Where("status = ?", opts.Status)
	}
	if opts.AgentID != nil {
		if *opts.AgentID == 0 {
			db = db.Where("agent_id IS NULL")
		} else {
			db = db.Where("agent_id = ?", *opts.AgentID)
		}
	}
	if opts.PlanID != 0 {
		db = db.Where("EXISTS (SELECT 1 FROM ent_subscriptions s WHERE s.enterprise_id = ent_enterprises.id AND s.plan_id = ? AND s.deleted_at IS NULL)", opts.PlanID)
	}
	if opts.ExpiringSoon != nil && *opts.ExpiringSoon {
		now := time.Now().UTC()
		db = db.Where("EXISTS (SELECT 1 FROM ent_subscriptions s WHERE s.enterprise_id = ent_enterprises.id AND s.status = 'active' AND s.expires_at BETWEEN ? AND ? AND s.deleted_at IS NULL)", now, now.Add(30*24*time.Hour))
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, mapEnterpriseError(err)
	}
	var records []model.Enterprise
	if err := db.Order("id DESC").Offset(opts.Offset).Limit(opts.Limit).Find(&records).Error; err != nil {
		return nil, 0, mapEnterpriseError(err)
	}
	items, err := r.hydrate(ctx, records)
	return items, total, err
}

func (r *enterpriseRepo) Update(ctx context.Context, item *biz.Enterprise, operatorID uint64) (*biz.EnterpriseDetail, error) {
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var before model.Enterprise
		if err := tx.First(&before, item.ID).Error; err != nil {
			return err
		}
		updates := map[string]any{
			"name": item.Name, "industry": item.Industry, "region": item.Region,
			"timezone": item.Timezone, "locale": item.Locale, "contact_name": item.ContactName,
			"contact_email": item.ContactEmail, "contact_phone": item.ContactPhone,
			"notification_json": jsonBytes(item.NotificationJSON), "remark": item.Remark,
			"agent_id": item.AgentID, "version": gorm.Expr("version + 1"),
		}
		result := tx.Model(&model.Enterprise{}).Where("id = ? AND version = ?", item.ID, item.Version).Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return biz.ErrEnterpriseConflict
		}
		return writeAdminAudit(ctx, tx, operatorID, "enterprise.update", "enterprise", strconv.FormatUint(item.ID, 10), "success", "", before, updates)
	})
	if err != nil {
		return nil, mapEnterpriseError(err)
	}
	return r.Get(ctx, item.ID)
}

func (r *enterpriseRepo) ChangeStatus(ctx context.Context, cmd biz.EnterpriseStatusCommand) (*biz.EnterpriseDetail, error) {
	status := "suspended"
	if cmd.Action == "activate" {
		status = "active"
	}
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var before model.Enterprise
		if err := tx.First(&before, cmd.ID).Error; err != nil {
			return err
		}
		result := tx.Model(&model.Enterprise{}).Where("id = ? AND version = ?", cmd.ID, cmd.Version).
			Updates(map[string]any{"status": status, "version": gorm.Expr("version + 1")})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return biz.ErrEnterpriseConflict
		}
		if err := tx.Model(&model.EnterpriseAccount{}).Where("enterprise_id = ?", cmd.ID).Update("status", status).Error; err != nil {
			return err
		}
		if status != "active" {
			if err := tx.Model(&model.LoginSession{}).Where("enterprise_id = ? AND revoked_at IS NULL", cmd.ID).
				Updates(map[string]any{"revoked_at": time.Now().UTC(), "revoke_reason": "enterprise_suspended"}).Error; err != nil {
				return err
			}
		}
		return writeAdminAudit(ctx, tx, cmd.OperatorID, "enterprise.status."+cmd.Action, "enterprise", strconv.FormatUint(cmd.ID, 10), "success", cmd.Reason, before, map[string]any{"status": status})
	})
	if err != nil {
		return nil, mapEnterpriseError(err)
	}
	return r.Get(ctx, cmd.ID)
}

func (r *enterpriseRepo) ResetPassword(ctx context.Context, cmd biz.EnterprisePasswordCommand) (*biz.EnterpriseAccount, error) {
	var account model.EnterpriseAccount
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		if err := tx.Where("enterprise_id = ?", cmd.ID).First(&account).Error; err != nil {
			return err
		}
		if err := tx.Model(&account).Updates(map[string]any{
			"password_hash": cmd.PasswordHash, "must_change_password": true,
			"failed_login_count": 0, "locked_until": nil,
		}).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.LoginSession{}).Where("enterprise_id = ? AND revoked_at IS NULL", cmd.ID).
			Updates(map[string]any{"revoked_at": time.Now().UTC(), "revoke_reason": "admin_password_reset"}).Error; err != nil {
			return err
		}
		return writeAdminAudit(ctx, tx, cmd.OperatorID, "enterprise.password.reset", "enterprise", strconv.FormatUint(cmd.ID, 10), "success", cmd.Reason, nil, map[string]any{"must_change_password": true})
	})
	if err != nil {
		return nil, mapEnterpriseError(err)
	}
	if err := r.data.DB(ctx).Where("enterprise_id = ?", cmd.ID).First(&account).Error; err != nil {
		return nil, mapEnterpriseError(err)
	}
	return enterpriseAccountDO(&account), nil
}

func (r *enterpriseRepo) SetSubscription(ctx context.Context, cmd biz.SubscriptionCommand) (*biz.Subscription, error) {
	var saved model.Subscription
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var before model.Subscription
		err := tx.Where("enterprise_id = ?", cmd.Subscription.EnterpriseID).Order("id DESC").First(&before).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		isNewSubscription := errors.Is(err, gorm.ErrRecordNotFound) || cmd.ExpectedVersion == 0
		// 套餐变更（换套餐）时：新订阅从换套餐当下起算，按新套餐周期推算到期时间；
		// 套餐未变更（仅改 auto_renew 等字段）时：沿用原 starts_at 推算，保证到期时间不重置。
		// 到期时间统一为到期日北京时间 00:00:00（凌晨零点失效），忽略前端手动传入值。
		if cmd.Subscription.PlanID != 0 {
			planChanged := before.ID == 0 || before.PlanID != cmd.Subscription.PlanID
			baseStart := cmd.Subscription.StartsAt
			if planChanged {
				baseStart = time.Now().UTC()
				cmd.Subscription.StartsAt = baseStart
			}
			if !baseStart.IsZero() {
				var plan model.Plan
				if pErr := tx.First(&plan, cmd.Subscription.PlanID).Error; pErr == nil {
					cmd.Subscription.ExpiresAt = beijingMidnight(baseStart.Add(billingCycleDuration(plan.BillingCycle)))
				} else {
					cmd.Subscription.ExpiresAt = beijingMidnight(cmd.Subscription.ExpiresAt)
				}
			}
		}
		if isNewSubscription {
			if err == nil {
				if updateErr := tx.Model(&before).Update("status", "replaced").Error; updateErr != nil {
					return updateErr
				}
			}
			saved = *subscriptionPO(cmd.Subscription)
			saved.Version = 1
			if createErr := tx.Create(&saved).Error; createErr != nil {
				return createErr
			}
			// 创建订单记录（仅当新订阅且为 active 状态时）
			if saved.Status == "active" && saved.PlanID != 0 {
				var plan model.Plan
				if err := tx.First(&plan, saved.PlanID).Error; err == nil {
					now := time.Now().UTC()
					order := &model.SubscriptionOrder{
						TenantModel:      model.TenantModel{EnterpriseID: saved.EnterpriseID},
						OrderNo:          generateOrderNo("PL"),
						PlanID:           &saved.PlanID,
						OrderType:        biz.OrderTypePlan,
						AmountMinorUnits: 0,
						Currency:         plan.Currency,
						Status:           biz.OrderStatusApproved,
						Source:           biz.OrderSourceAdminEdit,
						ApprovedAt:       &now,
						ApprovedBy:       &cmd.OperatorID,
						Remark:           cmd.Reason,
					}
					if err := tx.Create(order).Error; err == nil {
						saved.ActivatedOrderID = &order.ID
						tx.Model(&saved).Update("activated_order_id", order.ID)
					}
				}
			}
		} else {
			result := tx.Model(&model.Subscription{}).
				Where("id = ? AND version = ?", before.ID, cmd.ExpectedVersion).
				Updates(map[string]any{
					"plan_id": cmd.Subscription.PlanID, "status": cmd.Subscription.Status,
					"starts_at": cmd.Subscription.StartsAt, "expires_at": cmd.Subscription.ExpiresAt,
					"auto_renew": cmd.Subscription.AutoRenew, "version": gorm.Expr("version + 1"),
				})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return biz.ErrEnterpriseConflict
			}
			if getErr := tx.First(&saved, before.ID).Error; getErr != nil {
				return getErr
			}
		}
		// 订阅生效时自动从 ent_plan_limits 种子化 ent_quota_limits，
		// 避免管理员开通后还需手工配置额度。
		if saved.Status == "active" && saved.PlanID != 0 {
			if err := seedQuotaLimitsFromPlan(tx, saved.EnterpriseID, saved.PlanID); err != nil {
				return err
			}
		}
		return writeAdminAudit(ctx, tx, cmd.OperatorID, "enterprise.subscription.set", "enterprise", strconv.FormatUint(cmd.Subscription.EnterpriseID, 10), "success", cmd.Reason, before, saved)
	})
	if err != nil {
		return nil, mapEnterpriseError(err)
	}
	result := subscriptionDO(&saved)
	var plan model.Plan
	if err := r.data.DB(ctx).First(&plan, saved.PlanID).Error; err == nil {
		result.PlanName = plan.Name
	}
	return result, nil
}

func (r *enterpriseRepo) SetQuota(ctx context.Context, cmd biz.QuotaCommand) (*biz.QuotaLimit, error) {
	var saved model.QuotaLimit
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		err := tx.Where("enterprise_id = ? AND metric = ?", cmd.Quota.EnterpriseID, cmd.Quota.Metric).First(&saved).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			saved = *quotaPO(cmd.Quota)
			if createErr := tx.Create(&saved).Error; createErr != nil {
				return createErr
			}
		} else if err != nil {
			return err
		} else {
			if updateErr := tx.Model(&saved).Updates(map[string]any{
				"limit_value": cmd.Quota.LimitValue, "period": cmd.Quota.Period, "reset_at": cmd.Quota.ResetAt,
			}).Error; updateErr != nil {
				return updateErr
			}
			if getErr := tx.First(&saved, saved.ID).Error; getErr != nil {
				return getErr
			}
		}
		return writeAdminAudit(ctx, tx, cmd.OperatorID, "enterprise.quota.set", "enterprise", strconv.FormatUint(cmd.Quota.EnterpriseID, 10), "success", cmd.Reason, nil, saved)
	})
	if err != nil {
		return nil, mapEnterpriseError(err)
	}
	return quotaDO(&saved), nil
}

func (r *enterpriseRepo) hydrate(ctx context.Context, records []model.Enterprise) ([]*biz.EnterpriseDetail, error) {
	items := make([]*biz.EnterpriseDetail, 0, len(records))
	if len(records) == 0 {
		return items, nil
	}
	ids := make([]uint64, 0, len(records))
	details := make(map[uint64]*biz.EnterpriseDetail, len(records))
	for i := range records {
		id := records[i].ID
		ids = append(ids, id)
		detail := &biz.EnterpriseDetail{Enterprise: enterpriseDO(&records[i]), Quotas: make([]*biz.QuotaLimit, 0)}
		details[id] = detail
		items = append(items, detail)
	}
	var accounts []model.EnterpriseAccount
	if err := r.data.DB(ctx).Where("enterprise_id IN ?", ids).Find(&accounts).Error; err != nil {
		return nil, mapEnterpriseError(err)
	}
	for i := range accounts {
		details[accounts[i].EnterpriseID].Account = enterpriseAccountDO(&accounts[i])
	}
	var subscriptions []model.Subscription
	if err := r.data.DB(ctx).Where("enterprise_id IN ?", ids).Order("enterprise_id ASC, id DESC").Find(&subscriptions).Error; err != nil {
		return nil, mapEnterpriseError(err)
	}
	planIDs := make([]uint64, 0)
	seenSubscription := make(map[uint64]struct{}, len(records))
	for i := range subscriptions {
		if _, ok := seenSubscription[subscriptions[i].EnterpriseID]; ok {
			continue
		}
		seenSubscription[subscriptions[i].EnterpriseID] = struct{}{}
		details[subscriptions[i].EnterpriseID].Subscription = subscriptionDO(&subscriptions[i])
		planIDs = append(planIDs, subscriptions[i].PlanID)
	}
	if len(planIDs) > 0 {
		var plans []model.Plan
		if err := r.data.DB(ctx).Where("id IN ?", planIDs).Find(&plans).Error; err != nil {
			return nil, mapEnterpriseError(err)
		}
		planNames := make(map[uint64]string, len(plans))
		for i := range plans {
			planNames[plans[i].ID] = plans[i].Name
		}
		for _, detail := range details {
			if detail.Subscription != nil {
				detail.Subscription.PlanName = planNames[detail.Subscription.PlanID]
			}
		}
	}
	var quotas []model.QuotaLimit
	if err := r.data.DB(ctx).Where("enterprise_id IN ?", ids).Order("metric ASC").Find(&quotas).Error; err != nil {
		return nil, mapEnterpriseError(err)
	}
	for i := range quotas {
		details[quotas[i].EnterpriseID].Quotas = append(details[quotas[i].EnterpriseID].Quotas, quotaDO(&quotas[i]))
	}
	type articleCountRow struct {
		EnterpriseID uint64
		Total        int64
		Published    int64
	}
	var articleCounts []articleCountRow
	if err := r.data.DB(ctx).Model(&model.Article{}).
		Select("enterprise_id, COUNT(*) AS total, SUM(CASE WHEN published_at IS NOT NULL THEN 1 ELSE 0 END) AS published").
		Where("enterprise_id IN ?", ids).
		Group("enterprise_id").
		Scan(&articleCounts).Error; err != nil {
		return nil, mapEnterpriseError(err)
	}
	for i := range articleCounts {
		if detail, ok := details[articleCounts[i].EnterpriseID]; ok {
			detail.ArticleCount = articleCounts[i].Total
			detail.PublishedCount = articleCounts[i].Published
		}
	}
	// 使用成功发布任务数作为已发布数量的补充来源。
	// 当 published_at 未被设置时（例如旧的发布记录），仍可通过发布任务统计。
	type publishCountRow struct {
		EnterpriseID uint64
		Published    int64
	}
	var publishCounts []publishCountRow
	if err := r.data.DB(ctx).Model(&model.PublishTask{}).
		Select("enterprise_id, COUNT(*) AS published").
		Where("enterprise_id IN ? AND status = ?", ids, "succeeded").
		Group("enterprise_id").
		Scan(&publishCounts).Error; err != nil {
		return nil, mapEnterpriseError(err)
	}
	for i := range publishCounts {
		if detail, ok := details[publishCounts[i].EnterpriseID]; ok {
			// 取文章已发布数和发布任务数中的较大值，确保已发布数不为 0
			if publishCounts[i].Published > detail.PublishedCount {
				detail.PublishedCount = publishCounts[i].Published
			}
		}
	}
	// 查询点数余额（毫点）。无记录视为 0。
	var pointsBalances []model.PointsBalance
	if err := r.data.DB(ctx).Where("enterprise_id IN ?", ids).Find(&pointsBalances).Error; err == nil {
		for i := range pointsBalances {
			if detail, ok := details[pointsBalances[i].EnterpriseID]; ok {
				detail.PointsBalance = pointsBalances[i].Balance
				detail.PointsFrozen = pointsBalances[i].Frozen
			}
		}
	}
	return items, nil
}

func enterprisePO(item *biz.Enterprise) *model.Enterprise {
	return &model.Enterprise{
		AgentID: item.AgentID, Code: item.Code, Name: item.Name, Status: item.Status,
		Industry: item.Industry, Region: item.Region, Timezone: item.Timezone, Locale: item.Locale,
		ContactName: item.ContactName, ContactEmail: item.ContactEmail, ContactPhone: item.ContactPhone,
		NotificationJSON: jsonBytes(item.NotificationJSON), Remark: item.Remark, Version: item.Version,
	}
}

func enterpriseDO(item *model.Enterprise) *biz.Enterprise {
	return &biz.Enterprise{
		ID: item.ID, AgentID: item.AgentID, Code: item.Code, Name: item.Name, Status: item.Status,
		Industry: item.Industry, Region: item.Region, Timezone: item.Timezone, Locale: item.Locale,
		ContactName: item.ContactName, ContactEmail: item.ContactEmail, ContactPhone: item.ContactPhone,
		NotificationJSON: string(item.NotificationJSON), Remark: item.Remark, Version: item.Version,
		CreatedAt: item.CreatedAt, UpdatedAt: item.UpdatedAt,
	}
}

func enterpriseAccountPO(item *biz.EnterpriseAccount) *model.EnterpriseAccount {
	return &model.EnterpriseAccount{
		EnterpriseID: item.EnterpriseID, Username: item.Username, Email: item.Email, Phone: item.Phone,
		PasswordHash: item.PasswordHash, Status: item.Status, MustChangePassword: item.MustChangePassword,
		FailedLoginCount: item.FailedLoginCount, LockedUntil: item.LockedUntil, LastLoginAt: item.LastLoginAt,
	}
}

func enterpriseAccountDO(item *model.EnterpriseAccount) *biz.EnterpriseAccount {
	return &biz.EnterpriseAccount{
		ID: item.ID, EnterpriseID: item.EnterpriseID, Username: item.Username, Email: item.Email,
		Phone: item.Phone, Status: item.Status, MustChangePassword: item.MustChangePassword,
		FailedLoginCount: item.FailedLoginCount, LockedUntil: item.LockedUntil, LastLoginAt: item.LastLoginAt,
	}
}

func subscriptionPO(item *biz.Subscription) *model.Subscription {
	return &model.Subscription{
		TenantModel: model.TenantModel{EnterpriseID: item.EnterpriseID}, PlanID: item.PlanID,
		ActivatedOrderID: item.ActivatedOrderID,
		Status:           item.Status, StartsAt: item.StartsAt, ExpiresAt: item.ExpiresAt,
		AutoRenew: item.AutoRenew, ExpiredAtProcessed: item.ExpiredAtProcessed, Version: item.Version,
	}
}

func subscriptionDO(item *model.Subscription) *biz.Subscription {
	return &biz.Subscription{
		ID: item.ID, EnterpriseID: item.EnterpriseID, PlanID: item.PlanID,
		ActivatedOrderID: item.ActivatedOrderID,
		Status:           item.Status, StartsAt: item.StartsAt, ExpiresAt: item.ExpiresAt,
		AutoRenew: item.AutoRenew, ExpiredAtProcessed: item.ExpiredAtProcessed, Version: item.Version,
	}
}

func quotaPO(item *biz.QuotaLimit) *model.QuotaLimit {
	return &model.QuotaLimit{
		TenantModel: model.TenantModel{EnterpriseID: item.EnterpriseID}, Metric: item.Metric,
		LimitValue: item.LimitValue, UsedValue: item.UsedValue, ReservedValue: item.ReservedValue,
		Period: item.Period, ResetAt: item.ResetAt,
	}
}

func quotaDO(item *model.QuotaLimit) *biz.QuotaLimit {
	return &biz.QuotaLimit{
		ID: item.ID, EnterpriseID: item.EnterpriseID, Metric: item.Metric,
		LimitValue: item.LimitValue, UsedValue: item.UsedValue, ReservedValue: item.ReservedValue,
		Period: item.Period, ResetAt: item.ResetAt,
	}
}

// seedQuotaLimitsFromPlan 从 ent_plan_limits 读取指定 plan 的所有 metric 配额，
// 批量 upsert 到 ent_quota_limits，打通 plan_limits 与 quota_limits。
// 新建配额行时自动回填历史数据的 used_value。
// 已有配额行时只更新 limit_value 和 period，保留 used_value（由配额流水维护）。
func seedQuotaLimitsFromPlan(tx *gorm.DB, enterpriseID, planID uint64) error {
	var planLimits []model.PlanLimit
	if err := tx.Where("plan_id = ?", planID).Find(&planLimits).Error; err != nil {
		return err
	}
	planMetrics := make(map[string]bool)
	for _, pl := range planLimits {
		metricStr, ok := biz.PlanMetricToQuotaString[pl.Metric]
		if !ok {
			continue // 未知 metric 枚举值，跳过
		}
		planMetrics[metricStr] = true
		periodStr, ok := biz.QuotaPeriodIntToString[pl.Period]
		if !ok {
			periodStr = "yearly" // 默认按年
		}
		var existing model.QuotaLimit
		err := tx.Where("enterprise_id = ? AND metric = ?", enterpriseID, metricStr).First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// 新建额度限制行，回填历史数据的 used_value
			usedValue := backfillQuotaUsedValue(tx, enterpriseID, metricStr)
			row := model.QuotaLimit{
				TenantModel: model.TenantModel{EnterpriseID: enterpriseID},
				Metric:      metricStr,
				LimitValue:  pl.LimitValue,
				UsedValue:   usedValue,
				Period:      periodStr,
			}
			if err := tx.Create(&row).Error; err != nil {
				return err
			}
		} else if err != nil {
			return err
		} else {
			// 已存在：只更新 limit_value 和 period，保留 used_value。
			// used_value 由配额流水（reserve/settle/release）实时维护，
			// 用 backfill 覆盖会破坏流水的累计值（例如删除资源后 used_value
			// 未及时归零，下次套餐变更又把已删除数据统计回来）。
			updates := map[string]any{
				"limit_value": pl.LimitValue,
				"period":      periodStr,
			}
			if err := tx.Model(&existing).Updates(updates).Error; err != nil {
				return err
			}
		}
	}
	// 清理套餐定义中已不存在的指标配额
	if len(planMetrics) > 0 {
		if err := tx.Where("enterprise_id = ? AND metric NOT IN ?", enterpriseID, getPlanMetricStrings()).Delete(&model.QuotaLimit{}).Error; err != nil {
			return err
		}
	}
	return nil
}

// backfillQuotaUsedValue 根据指标类型查询对应的业务表，回填历史数据的使用量。
func backfillQuotaUsedValue(tx *gorm.DB, enterpriseID uint64, metric string) int64 {
	var count int64
	switch metric {
	case "brand_keywords":
		// 品牌关键词：统计 cnt_brands 表中状态为 active 的记录数
		tx.Table(model.TableBrands).Where("enterprise_id = ? AND status = ?", enterpriseID, 1).Count(&count)
	case "custom_keywords":
		// 产品关键词：统计 cnt_keywords 表中状态为 active 的记录数
		tx.Table(model.TableKeywords).Where("enterprise_id = ? AND status = ?", enterpriseID, "active").Count(&count)
	case "article_generations":
		// 词条数：统计 cnt_questions 表中非 rejected 状态的记录数
		tx.Table(model.TableQuestions).Where("enterprise_id = ? AND status != ?", enterpriseID, 3).Count(&count)
	case "publish_tasks":
		// 发布篇数：统计 pub_tasks 表中状态为 succeeded 的记录数
		tx.Table(model.TablePublishTasks).Where("enterprise_id = ? AND status = ?", enterpriseID, "succeeded").Count(&count)
	case "ai_distills":
		// AI蒸馏次数：只统计成功完成的蒸馏任务（status=3=completed）
		tx.Table(model.TableKeywordDistillationTasks).Where("enterprise_id = ? AND status = ?", enterpriseID, 3).Count(&count)
	}
	return count
}

// getPlanMetricStrings 返回当前所有套餐指标的字符串集合
func getPlanMetricStrings() []string {
	metrics := make([]string, 0, len(biz.PlanMetricToQuotaString))
	for _, s := range biz.PlanMetricToQuotaString {
		metrics = append(metrics, s)
	}
	return metrics
}

func mapEnterpriseError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return biz.ErrEnterpriseNotFound
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) || errors.Is(err, biz.ErrEnterpriseConflict) {
		return biz.ErrEnterpriseConflict
	}
	return fmt.Errorf("enterprise repository: %w", err)
}
