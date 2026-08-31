package data

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"gorm.io/gorm"
	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/data/model"
	"kratos-svr/internal/query"
	"time"
)

type geoMonitorRepo struct{ data *Data }

// resolveDefaultAccount 在前端创建计划时未显式指定平台账号（platform_account_id=0）时，
// 按 enterprise + inclusion_site 自动查一条 Active + Enabled 的授权（优先 is_default=true，
// 否则取最新更新的），返回其 id。查不到返回 0（后续 task.PlatformAccountID 保持 nil，
// operator 端会走匿名访问模式）。仅用于生成 geo_tasks，不修改 plan 的 site_targets_json。
func (r *geoMonitorRepo) resolveDefaultAccount(tx *gorm.DB, enterpriseID, siteID uint64) uint64 {
	var auth model.InclusionSiteAuthorization
	// 优先 is_default=true 的 Active+Enabled 授权
	if e := tx.Where("enterprise_id = ? AND inclusion_site_id = ? AND authorization_status = ? AND usage_status = ? AND is_default = ?",
		enterpriseID, siteID, biz.AuthorizationStatusActive, biz.AuthorizationUsageEnabled, true).
		Order("updated_at DESC").First(&auth).Error; e == nil {
		return auth.ID
	}
	// 退而取任意 Active+Enabled 授权
	if e := tx.Where("enterprise_id = ? AND inclusion_site_id = ? AND authorization_status = ? AND usage_status = ?",
		enterpriseID, siteID, biz.AuthorizationStatusActive, biz.AuthorizationUsageEnabled).
		Order("updated_at DESC").First(&auth).Error; e == nil {
		return auth.ID
	}
	return 0
}

func NewGeoMonitorRepo(d *Data) biz.GeoMonitorRepo { return &geoMonitorRepo{data: d} }

// calcGeoTaskAmount 根据终端类型计算实际生成的任务数。
func calcGeoTaskAmount(questionCount, targetCount int, terminalTypes []int32) int64 {
	var amount int64
	for range terminalTypes {
		amount += int64(questionCount * targetCount)
	}
	return amount
}

type siteTarget struct {
	InclusionSiteID   uint64 `json:"inclusion_site_id"`
	PlatformAccountID uint64 `json:"platform_account_id"`
	ModelEntry        string `json:"model_entry"`
	Locale            string `json:"locale"`
	Region            string `json:"region"`
	Priority          int32  `json:"priority"`
}

func (r *geoMonitorRepo) CreatePlan(c context.Context, p *biz.MonitorPlan) (*biz.MonitorPlan, error) {
	var questions []uint64
	var targets []siteTarget
	if json.Unmarshal([]byte(p.QuestionIDsJSON), &questions) != nil || json.Unmarshal([]byte(p.SiteTargetsJSON), &targets) != nil || len(questions) == 0 || len(targets) == 0 {
		return nil, biz.ErrMonitorPlanInvalid
	}

	// Determine which terminals to generate tasks for
	terminalTypes := []int32{1} // Default: PC only
	if p.MonitorTerminal == 2 {
		terminalTypes = []int32{2} // Mobile only
	} else if p.MonitorTerminal == 3 {
		terminalTypes = []int32{1, 2} // Both PC and Mobile
	} else if p.MonitorTerminal == 0 {
		terminalTypes = []int32{1} // Fallback to PC if not set
	}

	var po model.MonitorPlan
	x := r.data.WithinTransaction(c, func(tx *gorm.DB) error {
		// Calculate total amount considering terminal types
		amount := calcGeoTaskAmount(len(questions), len(targets), terminalTypes)
		isOpenMode := isGeoQueryOpenMode(tx)

		if !isOpenMode {
			// 非开放模式：检查额度
			if e := reserveQuota(tx, p.EnterpriseID, "geo_queries", amount); e != nil {
				return e
			}
		}

		po = model.MonitorPlan{TenantModel: model.TenantModel{EnterpriseID: p.EnterpriseID}, Name: p.Name, BrandID: p.BrandID, Status: biz.MonitorPlanStatusActive, ScheduleType: p.ScheduleType, MonitorTerminal: p.MonitorTerminal, CronExpression: p.CronExpression, Timezone: p.Timezone, QuestionIDsJSON: []byte(p.QuestionIDsJSON), SiteTargetsJSON: []byte(p.SiteTargetsJSON), NextRunAt: p.NextRunAt, ClientRequestID: p.ClientRequestID, Version: 1}
		if e := tx.Create(&po).Error; e != nil {
			return e
		}
		scheduled := time.Now().UTC()
		if p.NextRunAt != nil {
			scheduled = *p.NextRunAt
		}
		for _, terminalType := range terminalTypes {
			for _, qid := range questions {
				var q model.Question
				if e := tx.Where("enterprise_id = ? AND id = ? AND brand_id = ? AND status = ?", p.EnterpriseID, qid, p.BrandID, biz.QuestionStatusApproved).First(&q).Error; e != nil {
					return biz.ErrMonitorPlanInvalid
				}
				for _, t := range targets {
				// Enterprise site grants are optional: when no grant record exists,
				// the site is allowed by default. Only an explicit enabled=false
				// grant blocks usage.
				var grant model.EnterpriseSiteGrant
				if e := tx.Where("enterprise_id = ? AND inclusion_site_id = ?", p.EnterpriseID, t.InclusionSiteID).First(&grant).Error; e == nil {
					if !grant.Enabled {
						return biz.ErrMonitorPlanInvalid
					}
				}
				task := model.GEOTask{TenantModel: model.TenantModel{EnterpriseID: p.EnterpriseID}, MonitorPlanID: &po.ID, BrandID: p.BrandID, QuestionID: qid, InclusionSiteID: t.InclusionSiteID, TerminalType: terminalType, ModelEntry: t.ModelEntry, Locale: t.Locale, Region: t.Region, Status: "queued", Priority: t.Priority, ScheduledAt: scheduled, MaxAttempts: 3, Version: 1}
					// 若前端未显式指定平台账号，后端按 enterprise+site 自动 resolve 默认授权
					accountID := t.PlatformAccountID
					if accountID == 0 {
						accountID = r.resolveDefaultAccount(tx, p.EnterpriseID, t.InclusionSiteID)
					}
					if accountID != 0 {
						var authorization model.InclusionSiteAuthorization
						if e := tx.Where("enterprise_id = ? AND id = ? AND inclusion_site_id = ? AND authorization_status = ?", p.EnterpriseID, accountID, t.InclusionSiteID, biz.AuthorizationStatusActive).First(&authorization).Error; e != nil {
							return biz.ErrMonitorPlanInvalid
						}
						task.PlatformAccountID = &accountID
					}
					if e := tx.Create(&task).Error; e != nil {
						return e
					}
				}
			}
		}
		if !isOpenMode {
			ledger := model.UsageLedger{ImmutableTenantModel: model.ImmutableTenantModel{EnterpriseID: p.EnterpriseID}, Metric: "geo_queries", Operation: "reserve", Amount: amount, ReferenceType: "monitor_plan", ReferenceID: po.ID, IdempotencyKey: "geo-plan:" + p.ClientRequestID, Reason: "monitor plan created"}
			if e := tx.Create(&ledger).Error; e != nil {
				return e
			}
		}
		payload, _ := json.Marshal(map[string]any{"monitor_plan_id": po.ID, "enterprise_id": p.EnterpriseID})
		if err := tx.Create(&model.OutboxEvent{AggregateType: "monitor_plan", AggregateID: fmt.Sprint(po.ID), EventType: "geo.plan.created", PayloadJSON: payload, IdempotencyKey: "geo-plan-created:" + p.ClientRequestID, Status: "pending", AvailableAt: time.Now().UTC()}).Error; err != nil {
			return err
		}
		if !isOpenMode {
			return settleQuota(tx, p.EnterpriseID, "geo_queries", amount, "monitor_plan", po.ID, fmt.Sprintf("geo-plan-settle-%d", po.ID))
		}
		return nil
	})
	if x != nil {
		return nil, mapGeoError(x)
	}
	return monitorPlanDO(&po), nil
}
func (r *geoMonitorRepo) GetPlan(c context.Context, e, id uint64) (*biz.MonitorPlan, error) {
	var p model.MonitorPlan
	if x := r.data.DB(c).Where("enterprise_id = ? AND id = ?", e, id).First(&p).Error; x != nil {
		return nil, mapGeoError(x)
	}
	return monitorPlanDO(&p), nil
}

// UpdatePlan 仅更新 name 字段，使用 version 做乐观锁，更新成功后 version 自增。
func (r *geoMonitorRepo) UpdatePlan(c context.Context, p *biz.MonitorPlan) (*biz.MonitorPlan, error) {
	res := r.data.DB(c).Model(&model.MonitorPlan{}).
		Where("enterprise_id = ? AND id = ? AND version = ?", p.EnterpriseID, p.ID, p.Version).
		Updates(map[string]any{
			"name":    p.Name,
			"version": gorm.Expr("version + 1"),
		})
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected != 1 {
		return nil, biz.ErrMonitorPlanConflict
	}
	return r.GetPlan(c, p.EnterpriseID, p.ID)
}

// DeletePlan 删除监测计划及其关联的所有任务（级联删除）。
func (r *geoMonitorRepo) DeletePlan(c context.Context, e, id uint64) error {
	return r.data.WithinTransaction(c, func(tx *gorm.DB) error {
		// 先删除关联的 geo_tasks
		if err := tx.Where("monitor_plan_id = ? AND enterprise_id = ?", id, e).
			Delete(&model.GEOTask{}).Error; err != nil {
			return err
		}
		// 再删除 monitor_plan
		if err := tx.Where("id = ? AND enterprise_id = ?", id, e).
			Delete(&model.MonitorPlan{}).Error; err != nil {
			return err
		}
		return nil
	})
}

// ListDuePlans returns active plans whose next_run_at has arrived.
// Called by the scheduler every minute.
func (r *geoMonitorRepo) ListDuePlans(c context.Context, now time.Time, limit int) ([]*biz.MonitorPlan, error) {
	var rows []model.MonitorPlan
	if x := r.data.DB(c).
		Where("status = ? AND next_run_at IS NOT NULL AND next_run_at <= ?", biz.MonitorPlanStatusActive, now).
		Order("next_run_at ASC").
		Limit(limit).
		Find(&rows).Error; x != nil {
		return nil, x
	}
	out := make([]*biz.MonitorPlan, 0, len(rows))
	for i := range rows {
		out = append(out, monitorPlanDO(&rows[i]))
	}
	return out, nil
}

// GenerateTasksForPlan creates geo_tasks for one plan cycle (question × site matrix),
// reserves quota, writes the usage ledger and outbox event, all in one transaction.
// Returns the number of tasks created. If quota is insufficient the plan is paused
// and ErrPublishQuota is returned so the scheduler can record the pause.
func (r *geoMonitorRepo) GenerateTasksForPlan(c context.Context, plan *biz.MonitorPlan, scheduledAt time.Time) (int, error) {
	var questions []uint64
	var targets []siteTarget
	if json.Unmarshal([]byte(plan.QuestionIDsJSON), &questions) != nil || json.Unmarshal([]byte(plan.SiteTargetsJSON), &targets) != nil || len(questions) == 0 || len(targets) == 0 {
		return 0, biz.ErrMonitorPlanInvalid
	}

	// Determine which terminals to generate tasks for
	terminalTypes := []int32{1} // Default: PC only
	if plan.MonitorTerminal == 2 {
		terminalTypes = []int32{2} // Mobile only
	} else if plan.MonitorTerminal == 3 {
		terminalTypes = []int32{1, 2} // Both PC and Mobile
	} else if plan.MonitorTerminal == 0 {
		terminalTypes = []int32{1} // Fallback to PC if not set
	}

	// Calculate total amount considering terminal types
	amount := calcGeoTaskAmount(len(questions), len(targets), terminalTypes)
	taskCount := 0

	x := r.data.WithinTransaction(c, func(tx *gorm.DB) error {
		if e := reserveQuota(tx, plan.EnterpriseID, "geo_queries", amount); e != nil {
			return e
		}
		now := time.Now().UTC()
		for _, terminalType := range terminalTypes {
			for _, qid := range questions {
				var q model.Question
				if e := tx.Where("enterprise_id = ? AND id = ? AND brand_id = ? AND status = ?", plan.EnterpriseID, qid, plan.BrandID, biz.QuestionStatusApproved).First(&q).Error; e != nil {
					return biz.ErrMonitorPlanInvalid
				}
				for _, t := range targets {
				var grant model.EnterpriseSiteGrant
				if e := tx.Where("enterprise_id = ? AND inclusion_site_id = ?", plan.EnterpriseID, t.InclusionSiteID).First(&grant).Error; e == nil {
					if !grant.Enabled {
						return biz.ErrMonitorPlanInvalid
					}
				}
					task := model.GEOTask{
						TenantModel:      model.TenantModel{EnterpriseID: plan.EnterpriseID},
						MonitorPlanID:    &plan.ID,
						BrandID:          plan.BrandID,
						QuestionID:       qid,
						InclusionSiteID:  t.InclusionSiteID,
						TerminalType:     terminalType,
						ModelEntry:       t.ModelEntry,
						Locale:           t.Locale,
						Region:           t.Region,
						Status:           "queued",
						Priority:         t.Priority,
						ScheduledAt:      scheduledAt,
						MaxAttempts:      3,
						Version:          1,
					}
					// 若前端未显式指定平台账号，后端按 enterprise+site 自动 resolve 默认授权
					accountID := t.PlatformAccountID
					if accountID == 0 {
						accountID = r.resolveDefaultAccount(tx, plan.EnterpriseID, t.InclusionSiteID)
					}
					if accountID != 0 {
						var authorization model.InclusionSiteAuthorization
						if e := tx.Where("enterprise_id = ? AND id = ? AND inclusion_site_id = ? AND authorization_status = ?", plan.EnterpriseID, accountID, t.InclusionSiteID, biz.AuthorizationStatusActive).First(&authorization).Error; e != nil {
							return biz.ErrMonitorPlanInvalid
						}
						task.PlatformAccountID = &accountID
					}
					if e := tx.Create(&task).Error; e != nil {
						return e
					}
					taskCount++
				}
			}
		}
		ledger := model.UsageLedger{
			ImmutableTenantModel: model.ImmutableTenantModel{EnterpriseID: plan.EnterpriseID},
			Metric:               "geo_queries",
			Operation:            "reserve",
			Amount:               amount,
			ReferenceType:        "monitor_plan",
			ReferenceID:          plan.ID,
			IdempotencyKey:       fmt.Sprintf("geo-plan-%d-%d", plan.ID, now.Unix()),
			Reason:               "scheduled monitor plan cycle",
		}
		if e := tx.Create(&ledger).Error; e != nil {
			return e
		}
		payload, _ := json.Marshal(map[string]any{"monitor_plan_id": plan.ID, "enterprise_id": plan.EnterpriseID})
		if err := tx.Create(&model.OutboxEvent{
			AggregateType:   "monitor_plan",
			AggregateID:     fmt.Sprint(plan.ID),
			EventType:       "geo.plan.cycle",
			PayloadJSON:     payload,
			IdempotencyKey:  fmt.Sprintf("geo-plan-cycle-%d-%d", plan.ID, now.Unix()),
			Status:          "pending",
			AvailableAt:     now,
		}).Error; err != nil {
			return err
		}
		return settleQuota(tx, plan.EnterpriseID, "geo_queries", amount, "monitor_plan", plan.ID, fmt.Sprintf("geo-plan-cycle-settle-%d-%d", plan.ID, now.Unix()))
	})
	if x != nil {
		return 0, mapGeoError(x)
	}
	return taskCount, nil
}

// UpdatePlanSchedule sets last_run_at to now and next_run_at to the next cycle,
// incrementing the version for optimistic concurrency.
func (r *geoMonitorRepo) UpdatePlanSchedule(c context.Context, planID, version uint64, lastRunAt, nextRunAt *time.Time) error {
	updates := map[string]any{"last_run_at": lastRunAt, "version": gorm.Expr("version + 1")}
	if nextRunAt != nil {
		updates["next_run_at"] = *nextRunAt
	} else {
		updates["next_run_at"] = nil
	}
	res := r.data.DB(c).Model(&model.MonitorPlan{}).
		Where("id = ? AND version = ?", planID, version).
		Updates(updates)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected != 1 {
		return biz.ErrMonitorPlanConflict
	}
	return nil
}

// PausePlanDueToQuota marks a plan as paused when quota is exhausted during scheduling.
func (r *geoMonitorRepo) PausePlanDueToQuota(c context.Context, planID, version uint64) error {
	res := r.data.DB(c).Model(&model.MonitorPlan{}).
		Where("id = ? AND version = ?", planID, version).
		Updates(map[string]any{"status": biz.MonitorPlanStatusPaused, "version": gorm.Expr("version + 1")})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected != 1 {
		return biz.ErrMonitorPlanConflict
	}
	return nil
}
func (r *geoMonitorRepo) ListPlans(c context.Context, e uint64, o biz.MonitorListOptions) ([]*biz.MonitorPlan, int64, error) {
	db := r.data.DB(c).Model(&model.MonitorPlan{}).Where("enterprise_id = ?", e)
	if o.BrandID != 0 {
		db = db.Where("brand_id = ?", o.BrandID)
	}
	if o.Status != 0 {
		db = db.Where("status = ?", o.Status)
	}
	var total int64
	if x := db.Count(&total).Error; x != nil {
		return nil, 0, x
	}
	var rows []model.MonitorPlan
	if x := db.Order("created_at DESC, id DESC").Offset(o.Offset).Limit(o.Limit).Find(&rows).Error; x != nil {
		return nil, 0, x
	}
	out := make([]*biz.MonitorPlan, 0, len(rows))
	for i := range rows {
		out = append(out, monitorPlanDO(&rows[i]))
	}
	return out, total, nil
}
func (r *geoMonitorRepo) ChangePlanStatus(c context.Context, e, id, v uint64, a string) (*biz.MonitorPlan, error) {
	next := map[string]int32{"pause": biz.MonitorPlanStatusPaused, "resume": biz.MonitorPlanStatusActive, "stop": biz.MonitorPlanStatusStopped}[a]
	res := r.data.DB(c).Model(&model.MonitorPlan{}).Where("enterprise_id = ? AND id = ? AND version = ?", e, id, v).Updates(map[string]any{"status": next, "version": gorm.Expr("version + 1")})
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected != 1 {
		return nil, biz.ErrMonitorPlanConflict
	}
	return r.GetPlan(c, e, id)
}
func (r *geoMonitorRepo) ListTasks(c context.Context, e uint64, o biz.GeoTaskListOptions) ([]*biz.GeoTask, int64, error) {
	db := r.data.DB(c).Model(&model.GEOTask{}).Where("enterprise_id = ?", e)
	if o.MonitorPlanID != 0 {
		db = db.Where("monitor_plan_id = ?", o.MonitorPlanID)
	}
	if o.InclusionSiteID != 0 {
		db = db.Where("inclusion_site_id = ?", o.InclusionSiteID)
	}
	if o.Status != "" {
		db = db.Where("status = ?", o.Status)
	}
	var total int64
	if x := db.Count(&total).Error; x != nil {
		return nil, 0, x
	}
	// 使用子查询关联最新 AnswerSnapshot 的 session_ref 和 analysis_result 的 brand_mentioned，避免 N+1 查询
	var rows []struct {
		model.GEOTask
		SessionRef     string `gorm:"column:session_ref"`
		BrandMentioned bool   `gorm:"column:brand_mentioned"`
	}
	if x := db.
		Select("geo_tasks.*, "+
			"(SELECT session_ref FROM "+model.TableAnswerSnapshots+" WHERE geo_task_id = geo_tasks.id ORDER BY id DESC LIMIT 1) AS session_ref, "+
			"(SELECT ar.brand_mentioned FROM "+model.TableAnalysisResults+" ar "+
			"INNER JOIN "+model.TableAnswerSnapshots+" s ON s.id = ar.answer_snapshot_id "+
			"WHERE s.geo_task_id = geo_tasks.id ORDER BY ar.id DESC LIMIT 1) AS brand_mentioned").
		Order("created_at DESC, id DESC").Offset(o.Offset).Limit(o.Limit).Find(&rows).Error; x != nil {
		return nil, 0, x
	}
	out := make([]*biz.GeoTask, 0, len(rows))
	for i := range rows {
		task := geoTaskDO(&rows[i].GEOTask)
		task.SessionRef = rows[i].SessionRef
		task.BrandMentioned = rows[i].BrandMentioned
		out = append(out, task)
	}
	return out, total, nil
}
func (r *geoMonitorRepo) GetAnswer(c context.Context, e, taskID uint64) (*biz.GeoAnswer, error) {
	var s model.AnswerSnapshot
	if x := r.data.DB(c).Where("enterprise_id = ? AND geo_task_id = ?", e, taskID).Order("id DESC").First(&s).Error; x != nil {
		return nil, mapGeoError(x)
	}
	o := &biz.GeoAnswer{SnapshotID: s.ID, TaskID: taskID, QuestionText: s.QuestionText, AnswerText: s.AnswerText, AnswerStatus: s.AnswerStatus, ScreenshotKey: s.ScreenshotKey, EvidenceJSON: string(s.EvidenceJSON), SessionRef: s.SessionRef, ObservedAt: s.ObservedAt}
	var cs []model.Citation
	if x := r.data.DB(c).Where("enterprise_id = ? AND answer_snapshot_id = ?", e, s.ID).Order("position ASC").Find(&cs).Error; x != nil {
		return nil, x
	}
	for _, i := range cs {
		var aid uint64
		if i.ArticleID != nil {
			aid = *i.ArticleID
		}
		o.Citations = append(o.Citations, biz.Citation{URL: i.URL, Domain: i.Domain, Title: i.Title, Position: i.Position, EnterpriseSource: i.IsEnterpriseSource, ArticleID: aid})
	}
	var ms []model.Mention
	if x := r.data.DB(c).Where("enterprise_id = ? AND answer_snapshot_id = ?", e, s.ID).Order("position ASC").Find(&ms).Error; x != nil {
		return nil, x
	}
	for _, i := range ms {
		o.Mentions = append(o.Mentions, biz.Mention{EntityType: i.EntityType, EntityID: i.EntityID, Text: i.Text, Position: i.Position, Sentiment: i.Sentiment, Confidence: i.Confidence})
	}
	var a model.AnalysisResult
	if x := r.data.DB(c).Where("enterprise_id = ? AND answer_snapshot_id = ? AND status = ?", e, s.ID, "completed").Order("analysis_version DESC").First(&a).Error; x == nil {
		o.VisibilityScore = a.VisibilityScore
		o.AccuracyScore = a.AccuracyScore
		o.Confidence = a.Confidence
	} else if !errors.Is(x, gorm.ErrRecordNotFound) {
		return nil, x
	}
	return o, nil
}
func (r *geoMonitorRepo) GetMetrics(c context.Context, e uint64, f biz.MetricsFilter) (*biz.GeoMetrics, error) {
	var row metricAggregateRow
	if x := selectMetricAggregates(metricsQuery(r.data.DB(c), e, f)).Scan(&row).Error; x != nil {
		return nil, x
	}
	metrics := metricsFromAggregate(row)
	return &metrics, nil
}

func (r *geoMonitorRepo) ListTrend(c context.Context, e uint64, f biz.MetricsFilter) ([]*biz.GeoTrendPoint, error) {
	var rows []metricAggregateRow
	db := metricsQuery(r.data.DB(c), e, f).
		Select("DATE_FORMAT(s.observed_at, '%Y-%m-%d') AS bucket, " + metricAggregateSelect).
		Group("DATE_FORMAT(s.observed_at, '%Y-%m-%d')").Order("bucket ASC")
	if err := db.Scan(&rows).Error; err != nil {
		return nil, err
	}
	items := make([]*biz.GeoTrendPoint, 0, len(rows))
	for _, row := range rows {
		items = append(items, &biz.GeoTrendPoint{Date: row.Bucket, Metrics: metricsFromAggregate(row)})
	}
	return items, nil
}

func (r *geoMonitorRepo) ListSitePerformance(c context.Context, e uint64, f biz.MetricsFilter) ([]*biz.GeoSitePerformance, error) {
	var rows []metricAggregateRow
	db := metricsQuery(r.data.DB(c), e, f).
		Joins("JOIN " + model.TableInclusionSites + " AS site ON site.id = s.inclusion_site_id").
		Select("s.inclusion_site_id, site.name AS inclusion_site_name, " + metricAggregateSelect).
		Group("s.inclusion_site_id, site.name").Order("average_visibility_score DESC, s.inclusion_site_id ASC")
	if err := db.Scan(&rows).Error; err != nil {
		return nil, err
	}
	items := make([]*biz.GeoSitePerformance, 0, len(rows))
	for _, row := range rows {
		items = append(items, &biz.GeoSitePerformance{InclusionSiteID: row.InclusionSiteID, InclusionSiteName: row.InclusionSiteName, Metrics: metricsFromAggregate(row)})
	}
	return items, nil
}

const metricAggregateSelect = `COUNT(*) AS total_answers,
SUM(CASE WHEN s.answer_status = 'valid' THEN 1 ELSE 0 END) AS valid_answers,
SUM(CASE WHEN s.answer_status = 'valid' AND analysis.brand_mentioned = TRUE THEN 1 ELSE 0 END) AS mentioned_answers,
SUM(CASE WHEN s.answer_status = 'valid' AND analysis.enterprise_cited = TRUE THEN 1 ELSE 0 END) AS cited_answers,
COALESCE(AVG(CASE WHEN analysis.id IS NOT NULL THEN analysis.visibility_score END), 0) AS average_visibility_score`

type metricAggregateRow struct {
	Bucket                 string  `gorm:"column:bucket"`
	InclusionSiteID        uint64  `gorm:"column:inclusion_site_id"`
	InclusionSiteName      string  `gorm:"column:inclusion_site_name"`
	TotalAnswers           int64   `gorm:"column:total_answers"`
	ValidAnswers           int64   `gorm:"column:valid_answers"`
	MentionedAnswers       int64   `gorm:"column:mentioned_answers"`
	CitedAnswers           int64   `gorm:"column:cited_answers"`
	AverageVisibilityScore float64 `gorm:"column:average_visibility_score"`
}

func metricsQuery(db *gorm.DB, enterpriseID uint64, filter biz.MetricsFilter) *gorm.DB {
	db = db.Table(model.TableAnswerSnapshots+" AS s").
		Joins("JOIN "+model.TableGEOTasks+" AS task ON task.id = s.geo_task_id AND task.enterprise_id = s.enterprise_id").
		Joins("LEFT JOIN "+model.TableAnalysisResults+` AS analysis ON analysis.answer_snapshot_id = s.id
AND analysis.enterprise_id = s.enterprise_id AND analysis.status = 'completed'
AND analysis.analysis_version = (SELECT MAX(latest.analysis_version) FROM `+model.TableAnalysisResults+` AS latest
WHERE latest.answer_snapshot_id = s.id AND latest.enterprise_id = s.enterprise_id AND latest.status = 'completed')`).
		Where("s.enterprise_id = ?", enterpriseID)
	if filter.BrandID != 0 {
		db = db.Where("task.brand_id = ?", filter.BrandID)
	}
	if filter.InclusionSiteID != 0 {
		db = db.Where("s.inclusion_site_id = ?", filter.InclusionSiteID)
	}
	if !filter.From.IsZero() {
		db = db.Where("s.observed_at >= ?", filter.From)
	}
	if !filter.To.IsZero() {
		db = db.Where("s.observed_at < ?", filter.To)
	}
	return db
}

func selectMetricAggregates(db *gorm.DB) *gorm.DB {
	return db.Select(metricAggregateSelect)
}

func metricsFromAggregate(row metricAggregateRow) biz.GeoMetrics {
	metrics := biz.GeoMetrics{TotalAnswers: row.TotalAnswers, ValidAnswers: row.ValidAnswers, AverageVisibilityScore: row.AverageVisibilityScore}
	if row.ValidAnswers > 0 {
		metrics.BrandMentionRate = float64(row.MentionedAnswers) / float64(row.ValidAnswers)
		metrics.CitationRate = float64(row.CitedAnswers) / float64(row.ValidAnswers)
	}
	if row.TotalAnswers > 0 {
		metrics.QuestionCoverageRate = float64(row.ValidAnswers) / float64(row.TotalAnswers)
	}
	return metrics
}
func monitorPlanDO(p *model.MonitorPlan) *biz.MonitorPlan {
	return &biz.MonitorPlan{ID: p.ID, EnterpriseID: p.EnterpriseID, Name: p.Name, BrandID: p.BrandID, Status: p.Status, ScheduleType: p.ScheduleType, MonitorTerminal: p.MonitorTerminal, CronExpression: p.CronExpression, Timezone: p.Timezone, QuestionIDsJSON: string(p.QuestionIDsJSON), SiteTargetsJSON: string(p.SiteTargetsJSON), NextRunAt: p.NextRunAt, LastRunAt: p.LastRunAt, ClientRequestID: p.ClientRequestID, Version: p.Version, CreatedAt: p.CreatedAt}
}
func geoTaskDO(p *model.GEOTask) *biz.GeoTask {
	o := &biz.GeoTask{ID: p.ID, EnterpriseID: p.EnterpriseID, BrandID: p.BrandID, QuestionID: p.QuestionID, InclusionSiteID: p.InclusionSiteID, TerminalType: p.TerminalType, ModelEntry: p.ModelEntry, Locale: p.Locale, Region: p.Region, Status: p.Status, Priority: p.Priority, ScheduledAt: p.ScheduledAt, ErrorCategory: p.ErrorCategory, ErrorCode: p.ErrorCode, ErrorMessage: p.ErrorMessage, CompletedAt: p.CompletedAt}
	if p.MonitorPlanID != nil {
		o.MonitorPlanID = *p.MonitorPlanID
	}
	if p.PlatformAccountID != nil {
		o.PlatformAccountID = *p.PlatformAccountID
	}
	return o
}
func mapGeoError(e error) error {
	if errors.Is(e, gorm.ErrRecordNotFound) {
		return biz.ErrMonitorPlanNotFound
	}
	if errors.Is(e, gorm.ErrDuplicatedKey) {
		return biz.ErrMonitorPlanConflict
	}
	if errors.Is(e, biz.ErrPublishQuota) {
		return biz.ErrGeoQuotaExceeded
	}
	return e
}

// dashboardLatestAnalysisJoin returns the LEFT JOIN clause that resolves the
// latest completed analysis_result per answer_snapshot. Mirrors metricsQuery.
const dashboardLatestAnalysisJoin = "LEFT JOIN " + model.TableAnalysisResults + " AS analysis ON analysis.answer_snapshot_id = s.id" +
	" AND analysis.enterprise_id = s.enterprise_id AND analysis.status = 'completed'" +
	" AND analysis.analysis_version = (SELECT MAX(latest.analysis_version) FROM " + model.TableAnalysisResults + " AS latest" +
	" WHERE latest.answer_snapshot_id = s.id AND latest.enterprise_id = s.enterprise_id AND latest.status = 'completed')"

// dashboardLoc 是看板使用的展示时区（北京时间）。
// 数据库 observed_at 以 UTC 存储（DSN loc=UTC），日期分桶与范围边界
// 必须按北京时间计算，否则 UTC 16:00~23:59（北京时间次日 00:00~07:59）的数据
// 会被错误归到前一天，导致趋势图日期偏移。
var dashboardLoc = func() *time.Location {
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		return time.FixedZone("CST", 8*3600)
	}
	return loc
}()

// dashboardRange translates the API range token (7d/month/year) into [from, to] in UTC.
// 日期边界按北京时间 00:00 计算，再转换为 UTC 传给 SQL（数据库以 UTC 存储）。
func dashboardRange(r string) (time.Time, time.Time) {
	now := time.Now().In(dashboardLoc)
	switch r {
	case "month":
		from := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, dashboardLoc)
		return from.UTC(), now.UTC()
	case "year":
		from := time.Date(now.Year(), 1, 1, 0, 0, 0, 0, dashboardLoc)
		return from.UTC(), now.UTC()
	default: // 7d
		from := now.AddDate(0, 0, -6)
		start := time.Date(from.Year(), from.Month(), from.Day(), 0, 0, 0, 0, dashboardLoc)
		return start.UTC(), now.UTC()
	}
}

// dashboardTrendFormat picks the date bucket format based on range.
func dashboardTrendFormat(r string) string {
	if r == "year" {
		return "%Y-%m"
	}
	return "%Y-%m-%d"
}

// buildDashboardTrendSeries 生成完整的日期序列（北京时间），缺失日期补 0，保证折线图连续
func buildDashboardTrendSeries(r string, from, to time.Time, trendMap map[string]int64) []*biz.DashboardTrendPoint {
	var points []*biz.DashboardTrendPoint
	fromLocal := from.In(dashboardLoc)
	toLocal := to.In(dashboardLoc)
	if r == "year" {
		// 按月生成（1~12 月）
		year := fromLocal.Year()
		for m := 1; m <= 12; m++ {
			bucket := time.Date(year, time.Month(m), 1, 0, 0, 0, 0, dashboardLoc).Format("2006-01")
			points = append(points, &biz.DashboardTrendPoint{
				Date:     bucket,
				Included: trendMap[bucket],
			})
		}
		return points
	}
	// 7d / month 按天生成（北京时间日期）
	for d := time.Date(fromLocal.Year(), fromLocal.Month(), fromLocal.Day(), 0, 0, 0, 0, dashboardLoc); !d.After(toLocal); d = d.AddDate(0, 0, 1) {
		bucket := d.Format("2006-01-02")
		points = append(points, &biz.DashboardTrendPoint{
			Date:     bucket,
			Included: trendMap[bucket],
		})
	}
	return points
}

// GetDashboard aggregates enterprise-level GEO dashboard data in a single call.
func (r *geoMonitorRepo) GetDashboard(c context.Context, e uint64, o biz.DashboardOptions) (*biz.GeoDashboard, error) {
	db := r.data.DB(c)
	out := &biz.GeoDashboard{UpdatedAt: time.Now().UTC()}

	// ===== 1. Company card =====
	var enterprise model.Enterprise
	if x := db.Where("id = ?", e).First(&enterprise).Error; x != nil {
		return nil, mapGeoError(x)
	}
	var subscription model.Subscription
	_ = db.Where("enterprise_id = ? AND status = ?", e, "active").Order("starts_at DESC").First(&subscription).Error
	var brand model.Brand
	_ = db.Where("enterprise_id = ? AND status = ?", e, biz.BrandStatusActive).Order("id ASC").First(&brand).Error
	// 查询企业下所有品牌，用于 AI 画像展示
	var allBrands []model.Brand
	_ = db.Where("enterprise_id = ? AND status = ?", e, biz.BrandStatusActive).Order("id ASC").Find(&allBrands).Error
	brandNames := make([]string, 0, len(allBrands))
	for _, b := range allBrands {
		brandNames = append(brandNames, b.Name)
	}
	// 关键词与问题统计为企业级聚合（覆盖该企业所有品牌），与"关键词与问题"模块保持一致
	var keywords []model.Keyword
	_ = db.Where("enterprise_id = ? AND status = ?", e, "active").Order("id ASC").Limit(20).Find(&keywords).Error
	card := biz.DashboardCompanyCard{
		EnterpriseName: enterprise.Name,
		Contact:        enterprise.ContactPhone,
		Website:         brand.OfficialDomain,
		BrandName:       brand.Name,
		BrandNames:      brandNames,
	}
	if subscription.ID != 0 {
		card.OnlineAt = &subscription.StartsAt
		card.ExpireAt = &subscription.ExpiresAt
	}
	kwTexts := make([]string, 0, len(keywords))
	for _, k := range keywords {
		kwTexts = append(kwTexts, k.Text)
	}
	card.Keywords = kwTexts
	card.KeywordCount = int64(len(keywords))
	// 词条总量：所有非拒绝状态的问题数量（企业级，不限品牌）
	// 包括待审核(1)和已审核(2)，排除已拒绝(3)
	var questionCount int64
	_ = db.Table(model.TableQuestions).Where("enterprise_id = ? AND status != ?", e, biz.QuestionStatusRejected).Count(&questionCount).Error
	card.QuestionCount = questionCount
	// AI 训练量：当前企业查收录总数（收录+未收录的快照记录数），与收录总量形成"总量 vs 成功收录"对照
	// 只统计有效回答（answer_status='valid'），排除 empty（AI 没返回正文的无效记录）
	var aiTrainingCount int64
	_ = db.Table(model.TableAnswerSnapshots+" AS s").
		Where("s.enterprise_id = ? AND s.answer_status = 'valid'", e).
		Count(&aiTrainingCount).Error
	card.AITrainingCount = aiTrainingCount
	out.Company = card

	// ===== 2. Overview =====
	overview := biz.DashboardOverview{}
	var totalIncluded int64
	_ = db.Table(model.TableAnswerSnapshots+" AS s").
		Joins(dashboardLatestAnalysisJoin).
		Where("s.enterprise_id = ? AND s.answer_status = 'valid' AND analysis.brand_mentioned = TRUE", e).
		Count(&totalIncluded).Error
	overview.TotalIncluded = totalIncluded

	recentFrom := time.Now().UTC().AddDate(0, 0, -30)
	var recentIncluded int64
	_ = db.Table(model.TableAnswerSnapshots+" AS s").
		Joins(dashboardLatestAnalysisJoin).
		Where("s.enterprise_id = ? AND s.answer_status = 'valid' AND analysis.brand_mentioned = TRUE AND s.observed_at >= ?", e, recentFrom).
		Count(&recentIncluded).Error
	overview.RecentIncluded = recentIncluded

	// 文章发布总量：统计发布任务成功数（一篇文章多平台发布，每个平台算一次）
	var publishedArticles int64
	_ = db.Table(model.TablePublishTasks).Where("enterprise_id = ? AND status = ?", e, "succeeded").Count(&publishedArticles).Error
	overview.PublishedArticles = publishedArticles

	var contactExposure int64
	_ = db.Table(model.TableMentions+" AS m").
		Joins("JOIN "+model.TableAnswerSnapshots+" AS s ON s.id = m.answer_snapshot_id AND s.enterprise_id = m.enterprise_id").
		Where("s.enterprise_id = ? AND m.entity_type = ?", e, "contact").
		Count(&contactExposure).Error
	overview.ContactExposure = contactExposure
	out.Overview = overview

	// ===== 3. Trend =====
	// 按日期范围生成完整序列，缺失日期补 0，保证折线图连续
	// observed_at 以 UTC 存储，DATE_ADD(8 HOUR) 转为北京时间后再分桶
	from, to := dashboardRange(o.Range)
	bucketFmt := dashboardTrendFormat(o.Range)
	var trendRows []struct {
		Bucket   string `gorm:"column:bucket"`
		Included int64  `gorm:"column:included"`
	}
	_ = db.Table(model.TableAnswerSnapshots+" AS s").
		Joins(dashboardLatestAnalysisJoin).
		Select("DATE_FORMAT(DATE_ADD(s.observed_at, INTERVAL 8 HOUR), ?) AS bucket, COUNT(*) AS included", bucketFmt).
		Where("s.enterprise_id = ? AND s.answer_status = 'valid' AND analysis.brand_mentioned = TRUE AND s.observed_at >= ? AND s.observed_at < ?", e, from, to).
		Group("bucket").Order("bucket ASC").
		Scan(&trendRows).Error
	// 用 map 加速查找
	trendMap := make(map[string]int64, len(trendRows))
	for _, row := range trendRows {
		trendMap[row.Bucket] = row.Included
	}
	// 按范围生成完整日期序列
	out.Trend = buildDashboardTrendSeries(o.Range, from, to, trendMap)

	// ===== 4. Site stats =====
	var siteRows []struct {
		InclusionSiteID uint64 `gorm:"column:inclusion_site_id"`
		SiteName        string `gorm:"column:site_name"`
		Included        int64  `gorm:"column:included"`
	}
	_ = db.Table(model.TableAnswerSnapshots+" AS s").
		Joins(dashboardLatestAnalysisJoin).
		Joins("JOIN "+model.TableInclusionSites+" AS site ON site.id = s.inclusion_site_id").
		Select("s.inclusion_site_id, site.name AS site_name, COUNT(*) AS included").
		Where("s.enterprise_id = ? AND s.answer_status = 'valid' AND analysis.brand_mentioned = TRUE", e).
		Group("s.inclusion_site_id, site.name").
		Order("included DESC").
		Scan(&siteRows).Error
	out.SiteStats = make([]*biz.DashboardSiteStat, 0, len(siteRows))
	for _, row := range siteRows {
		out.SiteStats = append(out.SiteStats, &biz.DashboardSiteStat{
			InclusionSiteID: row.InclusionSiteID,
			SiteName:        row.SiteName,
			Included:        row.Included,
		})
	}

	// ===== 5. Top 热词榜（按问题收录次数排行）=====
	var kwRows []struct {
		KeywordID     uint64 `gorm:"column:keyword_id"`
		Keyword       string `gorm:"column:keyword"`
		IncludedCount int64  `gorm:"column:included_count"`
	}
	_ = db.Table(model.TableAnswerSnapshots+" AS s").
		Joins(dashboardLatestAnalysisJoin).
		Joins("JOIN "+model.TableGEOTasks+" AS task ON task.id = s.geo_task_id AND task.enterprise_id = s.enterprise_id").
		Joins("JOIN "+model.TableQuestions+" AS q ON q.id = task.question_id AND q.enterprise_id = task.enterprise_id").
		Select("q.id AS keyword_id, q.text AS keyword, COUNT(*) AS included_count").
		Where("s.enterprise_id = ? AND s.answer_status = 'valid' AND analysis.brand_mentioned = TRUE", e).
		Group("q.id, q.text").
		Order("included_count DESC").
		Limit(10).
		Scan(&kwRows).Error
	out.TopKeywords = make([]*biz.DashboardTopKeyword, 0, len(kwRows))
	for _, row := range kwRows {
		out.TopKeywords = append(out.TopKeywords, &biz.DashboardTopKeyword{
			KeywordID:     row.KeywordID,
			Keyword:       row.Keyword,
			IncludedCount: row.IncludedCount,
		})
	}

	// ===== 6. Tasks (paginated, only brand_mentioned=true) =====
	// 在 SQL 层过滤 brand_mentioned=true，避免分页取到未收录任务导致明细缺失
	pageSize := int32(o.PageSize)
	if pageSize <= 0 {
		pageSize = 10
	}
	var pageOffset int32
	if o.PageToken != "" {
		if v, x := query.ParsePage(pageSize, o.PageToken); x == nil {
			pageOffset = int32(v.Offset)
		}
	}

	// 子查询：每个 geo_task 最新 analysis_result 的 brand_mentioned（用于 WHERE 过滤，不带别名）
	taskBrandMentionedSubquery := "(SELECT ar.brand_mentioned FROM " + model.TableAnalysisResults + " AS ar " +
		"INNER JOIN " + model.TableAnswerSnapshots + " AS s ON s.id = ar.answer_snapshot_id " +
		"WHERE s.geo_task_id = geo_tasks.id ORDER BY ar.id DESC LIMIT 1)"

	taskQuery := db.Table(model.TableGEOTasks+" AS geo_tasks").
		Where("geo_tasks.enterprise_id = ?", e).
		Where("geo_tasks.status = ?", "succeeded").
		Where("geo_tasks.deleted_at IS NULL").
		Where(taskBrandMentionedSubquery + " = ?", true)
	if o.InclusionSiteID != 0 {
		taskQuery = taskQuery.Where("geo_tasks.inclusion_site_id = ?", o.InclusionSiteID)
	}

	// 统计收录成功任务总数
	var includedTaskTotal int64
	if x := taskQuery.Count(&includedTaskTotal).Error; x != nil {
		return nil, x
	}

	// 分页查询收录明细
	var taskRows []struct {
		model.GEOTask
		SessionRef string `gorm:"column:session_ref"`
	}
	sessionRefSelect := "(SELECT session_ref FROM " + model.TableAnswerSnapshots + " WHERE geo_task_id = geo_tasks.id ORDER BY id DESC LIMIT 1) AS session_ref"
	if x := taskQuery.
		Select("geo_tasks.*, " + sessionRefSelect).
		Order("geo_tasks.created_at DESC, geo_tasks.id DESC").
		Offset(int(pageOffset)).Limit(int(pageSize)).
		Find(&taskRows).Error; x != nil {
		return nil, x
	}
	out.Tasks = make([]*biz.GeoTask, 0, len(taskRows))
	for i := range taskRows {
		task := geoTaskDO(&taskRows[i].GEOTask)
		task.SessionRef = taskRows[i].SessionRef
		task.BrandMentioned = true
		out.Tasks = append(out.Tasks, task)
	}
	out.TotalSize = includedTaskTotal
	// 下一页 token：使用偏移量分页
	if int(pageOffset)+len(out.Tasks) < int(includedTaskTotal) && len(out.Tasks) == int(pageSize) {
		out.NextPageToken = query.NextToken(int(pageOffset) + len(out.Tasks))
	}
	return out, nil
}
