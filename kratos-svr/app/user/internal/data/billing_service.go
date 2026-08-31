package data

import (
	"encoding/json"
	stderrors "errors"
	"fmt"
	"sync"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/data/model"
)

// unitCostConfig 计费项单价配置（与 admin 端 unitCostValue 结构对齐）。
type unitCostConfig struct {
	Title       string  `json:"title"`
	Points      float64 `json:"points"`
	Unit        string  `json:"unit"`
	ChargeType  string  `json:"charge_type"`
	QuotaMetric string  `json:"quota_metric"`
}

const (
	chargeTypeBoth       = "both"       // 双扣：额度 + 点数
	chargeTypeQuotaOnly  = "quota_only" // 只扣额度
	chargeTypePointsOnly = "points_only" // 只扣点数
	chargeTypeOpen       = "open"       // 开放模式：不扣额度也不扣点数
)

// billingConfigCacheTTL 计费配置缓存有效期：admin 端修改后最多 30 秒生效。
const billingConfigCacheTTL = 30 * time.Second

// billingConfigCache 计费配置缓存（进程级 TTL 缓存，避免每次操作都查 cfg_system_settings）。
// admin 端在 /system/billing-config 修改点数/扣费模式后，最多 30 秒内 user 服务自动生效。
var billingConfigCache struct {
	sync.RWMutex
	loadedAt   time.Time
	unitCosts  map[string]unitCostConfig
}

// loadBillingConfig 从 cfg_system_settings 读取计费配置并缓存（TTL 30 秒）。
// 未配置时返回空 map（所有 action 视为无点数成本）。
// 缓存过期后会重新查库，确保 admin 端的修改能在 30 秒内生效。
func loadBillingConfig(tx *gorm.DB) (map[string]unitCostConfig, error) {
	billingConfigCache.RLock()
	if !billingConfigCache.loadedAt.IsZero() && time.Since(billingConfigCache.loadedAt) < billingConfigCacheTTL {
		costs := billingConfigCache.unitCosts
		billingConfigCache.RUnlock()
		return costs, nil
	}
	billingConfigCache.RUnlock()

	var setting model.SystemSetting
	costs := make(map[string]unitCostConfig)
	if err := tx.Where("namespace = ? AND key_name = ?", "billing", "unit_costs").First(&setting).Error; err != nil {
		if stderrors.Is(err, gorm.ErrRecordNotFound) {
			// 未配置计费项，返回空 map
		} else {
			return nil, err
		}
	} else {
		if err := json.Unmarshal(setting.ValueJSON, &costs); err != nil {
			return nil, biz.ErrBillingConfigParse
		}
	}

	billingConfigCache.Lock()
	billingConfigCache.unitCosts = costs
	billingConfigCache.loadedAt = time.Now()
	billingConfigCache.Unlock()
	return costs, nil
}

// billingReservation 记录一次预扣的账本信息，供 settle/rollback 使用。
// 写入 ent_points_ledgers 的 reserve 流水，settle 时写 settle 流水，rollback 时写 rollback 流水。
type billingReservation struct {
	enterpriseID   uint64
	action         string
	chargeType     string
	quotaMetric    string
	quotaAmount    int64  // 预扣的额度数量（0 表示未扣额度）
	pointsAmount   int64  // 预扣的毫点数（0 表示未扣点数）
	referenceType  string
	referenceID    uint64
	idempotencyKey string
}

// reserveBilling 双账本预扣：按 chargeType 决定扣额度、扣点数或两者都扣。
// 配额用尽且 chargeType=both 时自动回退到点数扣减。
// 必须在事务内调用，与 reserveQuota 一样使用 FOR UPDATE 锁。
// 对于额度扣减部分会写入 UsageLedger reserve 流水（与现有调用方手动写流水保持一致）。
func reserveBilling(tx *gorm.DB, enterpriseID uint64, action string, quantity int64, referenceType string, referenceID uint64, idempotencyKey string, reason string) (*billingReservation, error) {
	costs, err := loadBillingConfig(tx)
	if err != nil {
		return nil, err
	}
	cfg, ok := costs[action]
	if !ok {
		// 未配置计费项，不扣费（向后兼容）
		return &billingReservation{enterpriseID: enterpriseID, action: action}, nil
	}

	reservation := &billingReservation{
		enterpriseID:   enterpriseID,
		action:         action,
		chargeType:     cfg.ChargeType,
		quotaMetric:    cfg.QuotaMetric,
		referenceType:  referenceType,
		referenceID:    referenceID,
		idempotencyKey: idempotencyKey,
	}

	// 计算点数成本（毫点）：points（浮点"点"）× quantity × 1000
	pointsCost := int64(cfg.Points * float64(quantity) * 1000)

	switch cfg.ChargeType {
	case chargeTypeQuotaOnly:
		// 只扣额度
		if cfg.QuotaMetric == "" {
			return reservation, nil
		}
		if err := reserveQuota(tx, enterpriseID, cfg.QuotaMetric, quantity); err != nil {
			return nil, err
		}
		reservation.quotaAmount = quantity
		// 写额度 reserve 流水（审计用）
		if err := writeUsageLedger(tx, enterpriseID, cfg.QuotaMetric, "reserve", quantity, referenceType, referenceID, idempotencyKey, reason); err != nil {
			return nil, err
		}

	case chargeTypePointsOnly:
		// 只扣点数
		if pointsCost <= 0 {
			return reservation, nil
		}
		if err := reservePoints(tx, enterpriseID, pointsCost, referenceType, referenceID, idempotencyKey); err != nil {
			return nil, err
		}
		reservation.pointsAmount = pointsCost

	case chargeTypeBoth:
		// 双扣：先尝试额度，额度用尽则回退到点数
		if cfg.QuotaMetric != "" {
			quotaErr := reserveQuota(tx, enterpriseID, cfg.QuotaMetric, quantity)
			if quotaErr == nil {
				reservation.quotaAmount = quantity
				// 写额度 reserve 流水（审计用）
				if err := writeUsageLedger(tx, enterpriseID, cfg.QuotaMetric, "reserve", quantity, referenceType, referenceID, idempotencyKey, reason); err != nil {
					return nil, err
				}
			} else if stderrors.Is(quotaErr, biz.ErrPublishQuota) {
				// 额度用尽，回退到点数扣减
				if pointsCost > 0 {
					if err := reservePoints(tx, enterpriseID, pointsCost, referenceType, referenceID, idempotencyKey); err != nil {
						return nil, err
					}
					reservation.pointsAmount = pointsCost
				} else {
					// 点数成本为 0 且额度用尽，直接返回额度不足错误
					return nil, quotaErr
				}
			} else {
				return nil, quotaErr
			}
		} else {
			// 无 quota_metric 配置，只扣点数
			if pointsCost > 0 {
				if err := reservePoints(tx, enterpriseID, pointsCost, referenceType, referenceID, idempotencyKey); err != nil {
					return nil, err
				}
				reservation.pointsAmount = pointsCost
			}
		}

	case chargeTypeOpen:
		// 开放模式：不扣额度也不扣点数
		// 直接返回 reservation，不执行任何扣减操作
	}

	return reservation, nil
}

// writeUsageLedger 写额度流水（审计用，与现有调用方手动写 UsageLedger 保持一致）。
func writeUsageLedger(tx *gorm.DB, enterpriseID uint64, metric string, operation string, amount int64, referenceType string, referenceID uint64, idempotencyKey string, reason string) error {
	ledger := model.UsageLedger{
		ImmutableTenantModel: model.ImmutableTenantModel{EnterpriseID: enterpriseID},
		Metric:               metric,
		Operation:            operation,
		Amount:               amount,
		ReferenceType:        referenceType,
		ReferenceID:          referenceID,
		IdempotencyKey:       idempotencyKey,
		Reason:               reason,
	}
	return tx.Create(&ledger).Error
}

// settleBilling 任务成功时结算预扣：额度预留转已用，点数冻结转扣除。
func settleBilling(tx *gorm.DB, r *billingReservation) error {
	if r == nil || (r.quotaAmount == 0 && r.pointsAmount == 0) {
		return nil
	}
	if r.quotaAmount > 0 && r.quotaMetric != "" {
		settleKey := r.idempotencyKey + ":settle"
		if err := settleQuota(tx, r.enterpriseID, r.quotaMetric, r.quotaAmount, r.referenceType, r.referenceID, settleKey); err != nil {
			return err
		}
	}
	if r.pointsAmount > 0 {
		settleKey := r.idempotencyKey + ":points-settle"
		if err := settlePoints(tx, r.enterpriseID, r.pointsAmount, r.referenceType, r.referenceID, settleKey); err != nil {
			return err
		}
	}
	return nil
}

// rollbackBilling 任务失败时回滚预扣：额度预留归还，点数冻结归还。
func rollbackBilling(tx *gorm.DB, r *billingReservation) error {
	if r == nil || (r.quotaAmount == 0 && r.pointsAmount == 0) {
		return nil
	}
	if r.quotaAmount > 0 && r.quotaMetric != "" {
		releaseKey := r.idempotencyKey + ":release"
		if err := releaseQuota(tx, r.enterpriseID, r.quotaMetric, r.quotaAmount, r.referenceType, r.referenceID, releaseKey); err != nil {
			return err
		}
	}
	if r.pointsAmount > 0 {
		rollbackKey := r.idempotencyKey + ":points-rollback"
		if err := rollbackPoints(tx, r.enterpriseID, r.pointsAmount, r.referenceType, r.referenceID, rollbackKey); err != nil {
			return err
		}
	}
	return nil
}

// reservePoints 预扣冻结点数：frozen += amount，校验 balance - frozen >= 0。
func reservePoints(tx *gorm.DB, enterpriseID uint64, amountMilliPoints int64, referenceType string, referenceID uint64, idempotencyKey string) error {
	var pb model.PointsBalance
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("enterprise_id = ?", enterpriseID).First(&pb).Error
	if stderrors.Is(err, gorm.ErrRecordNotFound) {
		// 无余额记录，视为零余额
		return biz.ErrPointsInsufficient
	}
	if err != nil {
		return err
	}
	if pb.Balance-pb.Frozen-amountMilliPoints < 0 {
		return biz.ErrPointsInsufficient
	}
	if err := tx.Model(&pb).Updates(map[string]any{
		"frozen":  gorm.Expr("frozen + ?", amountMilliPoints),
		"version": gorm.Expr("version + 1"),
	}).Error; err != nil {
		return err
	}
	// 读取最新值写流水
	var latest model.PointsBalance
	if err := tx.Where("enterprise_id = ?", enterpriseID).First(&latest).Error; err != nil {
		return err
	}
	refID := referenceID
	ledger := &model.PointsLedger{
		ImmutableTenantModel: model.ImmutableTenantModel{EnterpriseID: enterpriseID},
		Operation:            biz.PointsOperationReserve,
		Amount:               amountMilliPoints,
		BalanceAfter:         latest.Balance,
		FrozenAfter:          latest.Frozen,
		ReferenceType:        referenceType,
		ReferenceID:          &refID,
		Reason:               "billing reserve",
		IdempotencyKey:       idempotencyKey,
	}
	return tx.Create(ledger).Error
}

// settlePoints 点数结算：frozen -= amount; balance -= amount。
func settlePoints(tx *gorm.DB, enterpriseID uint64, amountMilliPoints int64, referenceType string, referenceID uint64, idempotencyKey string) error {
	var pb model.PointsBalance
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("enterprise_id = ?", enterpriseID).First(&pb).Error
	if stderrors.Is(err, gorm.ErrRecordNotFound) {
		return nil // 无余额记录，无需结算
	}
	if err != nil {
		return err
	}
	if err := tx.Model(&pb).Updates(map[string]any{
		"frozen":  gorm.Expr("frozen - ?", amountMilliPoints),
		"balance": gorm.Expr("balance - ?", amountMilliPoints),
		"version": gorm.Expr("version + 1"),
	}).Error; err != nil {
		return err
	}
	var latest model.PointsBalance
	if err := tx.Where("enterprise_id = ?", enterpriseID).First(&latest).Error; err != nil {
		return err
	}
	refID := referenceID
	ledger := &model.PointsLedger{
		ImmutableTenantModel: model.ImmutableTenantModel{EnterpriseID: enterpriseID},
		Operation:            biz.PointsOperationSettle,
		Amount:               amountMilliPoints,
		BalanceAfter:         latest.Balance,
		FrozenAfter:          latest.Frozen,
		ReferenceType:        referenceType,
		ReferenceID:          &refID,
		Reason:               "billing settle",
		IdempotencyKey:       idempotencyKey,
	}
	return tx.Create(ledger).Error
}

// rollbackPoints 点数回滚：frozen -= amount。
func rollbackPoints(tx *gorm.DB, enterpriseID uint64, amountMilliPoints int64, referenceType string, referenceID uint64, idempotencyKey string) error {
	var pb model.PointsBalance
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("enterprise_id = ?", enterpriseID).First(&pb).Error
	if stderrors.Is(err, gorm.ErrRecordNotFound) {
		return nil // 无余额记录，无需回滚
	}
	if err != nil {
		return err
	}
	if err := tx.Model(&pb).Updates(map[string]any{
		"frozen":  gorm.Expr("frozen - ?", amountMilliPoints),
		"version": gorm.Expr("version + 1"),
	}).Error; err != nil {
		return err
	}
	var latest model.PointsBalance
	if err := tx.Where("enterprise_id = ?", enterpriseID).First(&latest).Error; err != nil {
		return err
	}
	refID := referenceID
	ledger := &model.PointsLedger{
		ImmutableTenantModel: model.ImmutableTenantModel{EnterpriseID: enterpriseID},
		Operation:            biz.PointsOperationRollback,
		Amount:               amountMilliPoints,
		BalanceAfter:         latest.Balance,
		FrozenAfter:          latest.Frozen,
		ReferenceType:        referenceType,
		ReferenceID:          &refID,
		Reason:               "billing rollback",
		IdempotencyKey:       idempotencyKey,
	}
	return tx.Create(ledger).Error
}

// ResetBillingConfigCache 重置计费配置缓存，供管理端更新配置后立即生效（如单元测试使用）。
// 正常运行时无需手动调用：loadBillingConfig 内置 30 秒 TTL，admin 端修改后会自动过期重载。
func ResetBillingConfigCache() {
	billingConfigCache.Lock()
	billingConfigCache.loadedAt = time.Time{}
	billingConfigCache.unitCosts = nil
	billingConfigCache.Unlock()
}

// formatBillingIdempotencyKey 生成统一的幂等键。
func formatBillingIdempotencyKey(prefix string, referenceID uint64) string {
	return fmt.Sprintf("%s:%d", prefix, referenceID)
}

// hasPointsReservation 检查指定 reference 是否有预扣点数流水（用于 settle/rollback 时判断是否走了点数扣费路径）。
func hasPointsReservation(tx *gorm.DB, enterpriseID uint64, referenceType string, referenceID uint64) (bool, error) {
	var count int64
	err := tx.Model(&model.PointsLedger{}).
		Where("enterprise_id = ? AND reference_type = ? AND reference_id = ? AND operation = ?",
			enterpriseID, referenceType, referenceID, biz.PointsOperationReserve).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// settleBillingByRef 根据任务引用结算预扣（无需 billingReservation 对象）。
// 通过查询 PointsLedger 判断是否走了点数扣费路径。
// quotaMetric/quantity 用于额度结算。
func settleBillingByRef(tx *gorm.DB, enterpriseID uint64, quotaMetric string, quantity int64, referenceType string, referenceID uint64, idempotencyKey string) error {
	// 检查是否走了点数扣费
	usedPoints, err := hasPointsReservation(tx, enterpriseID, referenceType, referenceID)
	if err != nil {
		return err
	}
	if usedPoints {
		// 走了点数路径，结算点数（frozen -= amount; balance -= amount）
		// 从 reserve 流水读取预扣金额
		var reserveLedger model.PointsLedger
		if err := tx.Where("enterprise_id = ? AND reference_type = ? AND reference_id = ? AND operation = ?",
			enterpriseID, referenceType, referenceID, biz.PointsOperationReserve).First(&reserveLedger).Error; err != nil {
			return err
		}
		settleKey := idempotencyKey + ":points-settle"
		return settlePoints(tx, enterpriseID, reserveLedger.Amount, referenceType, referenceID, settleKey)
	}
	// 走了额度路径，结算额度
	if quotaMetric != "" && quantity > 0 {
		settleKey := idempotencyKey + ":settle"
		return settleQuota(tx, enterpriseID, quotaMetric, quantity, referenceType, referenceID, settleKey)
	}
	return nil
}

// rollbackBillingByRef 根据任务引用回滚预扣（无需 billingReservation 对象）。
func rollbackBillingByRef(tx *gorm.DB, enterpriseID uint64, quotaMetric string, quantity int64, referenceType string, referenceID uint64, idempotencyKey string) error {
	usedPoints, err := hasPointsReservation(tx, enterpriseID, referenceType, referenceID)
	if err != nil {
		return err
	}
	if usedPoints {
		var reserveLedger model.PointsLedger
		if err := tx.Where("enterprise_id = ? AND reference_type = ? AND reference_id = ? AND operation = ?",
			enterpriseID, referenceType, referenceID, biz.PointsOperationReserve).First(&reserveLedger).Error; err != nil {
			return err
		}
		rollbackKey := idempotencyKey + ":points-rollback"
		return rollbackPoints(tx, enterpriseID, reserveLedger.Amount, referenceType, referenceID, rollbackKey)
	}
	if quotaMetric != "" && quantity > 0 {
		releaseKey := idempotencyKey + ":release"
		return releaseQuota(tx, enterpriseID, quotaMetric, quantity, referenceType, referenceID, releaseKey)
	}
	return nil
}

// isGeoQueryOpenMode 检查 GEO 检测是否为开放模式。
// 如果任一 GEO 相关计费项（inclusion_query、online_inclusion_query、screenshot_inclusion_query）的 charge_type 为 open，
// 则返回 true，表示 GEO 检测不扣额度也不扣点数。
func isGeoQueryOpenMode(tx *gorm.DB) bool {
	costs, err := loadBillingConfig(tx)
	if err != nil {
		return false // 配置加载失败时，默认不开放
	}
	geoActions := []string{"inclusion_query", "online_inclusion_query", "screenshot_inclusion_query"}
	for _, action := range geoActions {
		if cfg, ok := costs[action]; ok && cfg.ChargeType == chargeTypeOpen {
			return true
		}
	}
	return false
}
