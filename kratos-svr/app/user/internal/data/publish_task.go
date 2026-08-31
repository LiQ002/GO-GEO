package data

import (
	"context"
	"encoding/json"
	stderrors "errors"
	"fmt"
	"github.com/go-kratos/kratos/v3/errors"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/data/model"
	"time"
)

type publishTaskRepo struct{ data *Data }

func NewPublishTaskRepo(d *Data) biz.PublishTaskRepo { return &publishTaskRepo{data: d} }

// DedupCheck 去重检查：返回指定文章（+可选渠道）是否已有非失败任务。
// channelID=0 表示仅按文章查（用于 all_unique 策略）。
// 排除的状态：failed / cancelled / expired（视为可重投）。
var dedupExcludedStatuses = []string{"failed", "cancelled", "expired"}

func (r *publishTaskRepo) DedupCheck(ctx context.Context, enterpriseID, articleID, channelID uint64) (bool, error) {
	db := r.data.DB(ctx).Model(&model.PublishTask{}).Where("enterprise_id = ? AND article_id = ? AND status NOT IN ?", enterpriseID, articleID, dedupExcludedStatuses)
	if channelID != 0 {
		db = db.Where("publish_channel_id = ?", channelID)
	}
	var count int64
	if err := db.Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *publishTaskRepo) CreatePlan(c context.Context, p *biz.PublishPlan, assignments []biz.AssignTask) (*biz.PublishPlan, error) {
	var po model.PublishPlan
	x := r.data.WithinTransaction(c, func(tx *gorm.DB) error {
		// 校验所有文章 + 快照合法性，且文章状态必须为 normal
		articleStatus := make(map[uint64]bool, len(assignments))
		for _, a := range assignments {
			if articleStatus[a.ArticleID] {
				continue
			}
			var snap model.ArticleSnapshot
			if e := tx.Where("enterprise_id = ? AND id = ? AND article_id = ?", p.EnterpriseID, a.ArticleSnapshotID, a.ArticleID).First(&snap).Error; e != nil {
				return biz.ErrPublishPlanInvalid
			}
			var article model.Article
			if e := tx.Where("enterprise_id = ? AND id = ?", p.EnterpriseID, a.ArticleID).First(&article).Error; e != nil {
				return biz.ErrPublishPlanInvalid
			}
			if article.Status != biz.ArticleStatusNormal {
				return biz.ErrPublishArticleNotApproved
			}
			articleStatus[a.ArticleID] = true
		}
		// publish_tasks 配置为 charge_type=quota_only（points=0），无需点数回退，直接走额度校验。
		if e := reserveQuota(tx, p.EnterpriseID, "publish_tasks", int64(len(assignments))); e != nil {
			return e
		}
		// 新计划不再绑定单篇文章：ArticleID/ArticleSnapshotID 置 NULL
		po = model.PublishPlan{TenantModel: model.TenantModel{EnterpriseID: p.EnterpriseID}, Name: p.Name, Status: biz.PublishPlanStatusActive, ScheduleType: p.ScheduleType, ScheduledAt: p.ScheduledAt, Timezone: p.Timezone, FailurePolicyJSON: []byte(p.FailurePolicyJSON), DedupStrategy: p.DedupStrategy, ClientRequestID: p.ClientRequestID, Version: 1}
		if e := tx.Create(&po).Error; e != nil {
			return e
		}
		scheduled := time.Now().UTC()
		if p.ScheduledAt != nil {
			scheduled = *p.ScheduledAt
		}
		for _, a := range assignments {
			if e := validatePublishTargetTx(tx, p.EnterpriseID, a.PublishTargetInput); e != nil {
				return e
			}
			task := model.PublishTask{TenantModel: model.TenantModel{EnterpriseID: p.EnterpriseID}, PublishPlanID: po.ID, ArticleID: a.ArticleID, ArticleSnapshotID: a.ArticleSnapshotID, PublishChannelID: a.PublishChannelID, ExecutionMode: a.ExecutionMode, Status: "queued", Priority: a.Priority, ScheduledAt: scheduled, MaxAttempts: 3, Version: 1}
			if a.PublishTargetID != 0 {
				task.PublishTargetID = &a.PublishTargetID
			}
			if a.PlatformAccountID != 0 {
				task.PlatformAccountID = &a.PlatformAccountID
			}
			if e := tx.Create(&task).Error; e != nil {
				return e
			}
		}
		ledger := model.UsageLedger{ImmutableTenantModel: model.ImmutableTenantModel{EnterpriseID: p.EnterpriseID}, Metric: "publish_tasks", Operation: "reserve", Amount: int64(len(assignments)), ReferenceType: "publish_plan", ReferenceID: po.ID, IdempotencyKey: "publish-plan:" + p.ClientRequestID, Reason: "publish plan created"}
		if e := tx.Create(&ledger).Error; e != nil {
			return e
		}
		payload, _ := json.Marshal(map[string]any{"publish_plan_id": po.ID, "enterprise_id": p.EnterpriseID})
		outbox := model.OutboxEvent{AggregateType: "publish_plan", AggregateID: fmt.Sprint(po.ID), EventType: "publish.plan.created", PayloadJSON: payload, IdempotencyKey: "publish-plan-created:" + p.ClientRequestID, Status: "pending", AvailableAt: time.Now().UTC()}
		if err := tx.Create(&outbox).Error; err != nil {
			return err
		}
		return nil
	})
	if x != nil {
		return nil, mapPublishTaskError(x)
	}
	return publishPlanDO(&po), nil
}
func (r *publishTaskRepo) GetPlan(c context.Context, e, id uint64) (*biz.PublishPlan, []*biz.PublishTask, error) {
	var p model.PublishPlan
	if x := r.data.DB(c).Where("enterprise_id = ? AND id = ?", e, id).First(&p).Error; x != nil {
		return nil, nil, mapPublishTaskError(x)
	}
	var rows []model.PublishTask
	if x := r.data.DB(c).Where("enterprise_id = ? AND publish_plan_id = ?", e, id).Order("id ASC").Find(&rows).Error; x != nil {
		return nil, nil, x
	}
	tasks := make([]*biz.PublishTask, 0, len(rows))
	attemptByTask := make(map[uint64]model.PublishAttempt, len(rows))
	if len(rows) > 0 {
		taskIDs := make([]uint64, 0, len(rows))
		for i := range rows {
			taskIDs = append(taskIDs, rows[i].ID)
		}
		var attempts []model.PublishAttempt
		if x := r.data.DB(c).Where("enterprise_id = ? AND publish_task_id IN ?", e, taskIDs).Order("id DESC").Find(&attempts).Error; x != nil {
			return nil, nil, x
		}
		for i := range attempts {
			if _, exists := attemptByTask[attempts[i].PublishTaskID]; !exists {
				attemptByTask[attempts[i].PublishTaskID] = attempts[i]
			}
		}
	}
	for i := range rows {
		task := publishTaskDO(&rows[i])
		if attempt, exists := attemptByTask[rows[i].ID]; exists {
			task.ResultJSON = string(attempt.ResultJSON)
			task.EvidenceJSON = string(attempt.EvidenceJSON)
		}
		tasks = append(tasks, task)
	}
	plan := publishPlanDO(&p)
	// 新计划不再有单一文章标题；改为聚合首个任务对应文章的标题
	if len(rows) > 0 {
		titles := r.articleTitlesBySnapshotIDs(c, e, []uint64{rows[0].ArticleSnapshotID})
		plan.ArticleTitle = titles[rows[0].ArticleSnapshotID]
	}
	// 填充任务进度摘要
	r.fillPlanSummaries(c, e, []*biz.PublishPlan{plan})
	return plan, tasks, nil
}
func (r *publishTaskRepo) ListPlans(c context.Context, e uint64, o biz.PublishPlanListOptions) ([]*biz.PublishPlan, int64, error) {
	db := r.data.DB(c).Model(&model.PublishPlan{}).Where("enterprise_id = ?", e)
	if o.Status != 0 {
		db = db.Where("status = ?", o.Status)
	}
	if o.ArticleID != 0 {
		// 新计划 pub_plans.article_id 为 NULL，改为查 pub_tasks 中包含该文章的计划
		db = db.Where("id IN (?)", r.data.DB(c).Model(&model.PublishTask{}).Select("publish_plan_id").Where("enterprise_id = ? AND article_id = ?", e, o.ArticleID))
	}
	var total int64
	if x := db.Count(&total).Error; x != nil {
		return nil, 0, x
	}
	var rows []model.PublishPlan
	if x := db.Order("created_at DESC, id DESC").Offset(o.Offset).Limit(o.Limit).Find(&rows).Error; x != nil {
		return nil, 0, x
	}
	out := make([]*biz.PublishPlan, 0, len(rows))
	for i := range rows {
		out = append(out, publishPlanDO(&rows[i]))
	}
	// 批量查每个计划首个任务的快照标题（按 §4.2：ORDER BY MIN(id) 取最早 task 的文章）
	r.fillPlanArticleTitles(c, e, out)
	// 聚合每个计划的任务进度摘要（文章数/平台数/任务数/成功/失败）
	r.fillPlanSummaries(c, e, out)
	return out, total, nil
}

// fillPlanArticleTitles 为列表中的每个计划填充最早任务对应文章的标题。
// 与设计文档 §4.2 对齐：SELECT article_id FROM pub_tasks WHERE publish_plan_id=? GROUP BY article_id ORDER BY MIN(id)
// 取 id 最小的 task 对应的 article_snapshot_id 查标题。
func (r *publishTaskRepo) fillPlanArticleTitles(c context.Context, e uint64, plans []*biz.PublishPlan) {
	if len(plans) == 0 {
		return
	}
	planIDs := make([]uint64, 0, len(plans))
	for _, p := range plans {
		planIDs = append(planIDs, p.ID)
	}
	// 子查询：每个 plan 下 MIN(id) 的 task（即最早插入的任务）
	type firstTask struct {
		PublishPlanID     uint64
		ArticleSnapshotID uint64
	}
	var firstTasks []firstTask
	if err := r.data.DB(c).Raw(`
		SELECT t.publish_plan_id, t.article_snapshot_id
		FROM pub_tasks t
		INNER JOIN (
			SELECT publish_plan_id, MIN(id) AS min_id
			FROM pub_tasks
			WHERE enterprise_id = ? AND publish_plan_id IN ?
			GROUP BY publish_plan_id
		) m ON t.id = m.min_id
	`, e, planIDs).Scan(&firstTasks).Error; err != nil {
		return
	}
	if len(firstTasks) == 0 {
		return
	}
	snapshotIDs := make([]uint64, 0, len(firstTasks))
	planToSnapshot := make(map[uint64]uint64, len(firstTasks))
	for _, ft := range firstTasks {
		snapshotIDs = append(snapshotIDs, ft.ArticleSnapshotID)
		planToSnapshot[ft.PublishPlanID] = ft.ArticleSnapshotID
	}
	titles := r.articleTitlesBySnapshotIDs(c, e, snapshotIDs)
	for _, p := range plans {
		if snapID, ok := planToSnapshot[p.ID]; ok {
			p.ArticleTitle = titles[snapID]
		}
	}
}

// fillPlanSummaries 聚合每个计划的任务进度：文章数、平台数、任务总数、成功数、失败数。
func (r *publishTaskRepo) fillPlanSummaries(c context.Context, e uint64, plans []*biz.PublishPlan) {
	if len(plans) == 0 {
		return
	}
	planIDs := make([]uint64, 0, len(plans))
	for _, p := range plans {
		planIDs = append(planIDs, p.ID)
	}
	type summary struct {
		PublishPlanID   uint64
		ArticleCount    int32
		PlatformCount   int32
		TaskCount       int32
		SucceededCount  int32
		FailedCount     int32
	}
	var summaries []summary
	if err := r.data.DB(c).Raw(`
		SELECT publish_plan_id,
			COUNT(DISTINCT article_id) AS article_count,
			COUNT(DISTINCT publish_channel_id) AS platform_count,
			COUNT(*) AS task_count,
			SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) AS succeeded_count,
			SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count
		FROM pub_tasks
		WHERE enterprise_id = ? AND publish_plan_id IN ?
		GROUP BY publish_plan_id
	`, e, planIDs).Scan(&summaries).Error; err != nil {
		return
	}
	for _, s := range summaries {
		for _, p := range plans {
			if p.ID == s.PublishPlanID {
				p.ArticleCount = s.ArticleCount
				p.PlatformCount = s.PlatformCount
				p.TaskCount = s.TaskCount
				p.SucceededCount = s.SucceededCount
				p.FailedCount = s.FailedCount
				break
			}
		}
	}
}

func (r *publishTaskRepo) articleTitlesBySnapshotIDs(c context.Context, e uint64, ids []uint64) map[uint64]string {
	titles := make(map[uint64]string, len(ids))
	if len(ids) == 0 {
		return titles
	}
	var snapshots []model.ArticleSnapshot
	if err := r.data.DB(c).Where("enterprise_id = ? AND id IN ?", e, ids).Find(&snapshots).Error; err != nil {
		return titles
	}
	for i := range snapshots {
		titles[snapshots[i].ID] = snapshots[i].Title
	}
	return titles
}
func (r *publishTaskRepo) ChangePlanStatus(c context.Context, e, id, v uint64, action string) (*biz.PublishPlan, error) {
	next := map[string]int32{"pause": biz.PublishPlanStatusPaused, "resume": biz.PublishPlanStatusActive, "cancel": biz.PublishPlanStatusCancelled, "stop": biz.PublishPlanStatusStopped}[action]
	x := r.data.WithinTransaction(c, func(tx *gorm.DB) error {
		res := tx.Model(&model.PublishPlan{}).Where("enterprise_id = ? AND id = ? AND version = ?", e, id, v).Updates(map[string]any{"status": next, "version": gorm.Expr("version + 1")})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected != 1 {
			return biz.ErrPublishPlanConflict
		}
		if next == biz.PublishPlanStatusCancelled || next == biz.PublishPlanStatusStopped {
			return tx.Model(&model.PublishTask{}).Where("enterprise_id = ? AND publish_plan_id = ? AND status IN ?", e, id, []string{"queued", "leased"}).Updates(map[string]any{"status": "cancelled", "version": gorm.Expr("version + 1")}).Error
		}
		return nil
	})
	if x != nil {
		return nil, x
	}
	p, _, x := r.GetPlan(c, e, id)
	return p, x
}
func (r *publishTaskRepo) RetryTask(c context.Context, e, id, v uint64) (*biz.PublishTask, error) {
	res := r.data.DB(c).Model(&model.PublishTask{}).Where("enterprise_id = ? AND id = ? AND version = ? AND status IN ? AND attempt_count < max_attempts", e, id, v, []string{"failed", "manual_action_required", "expired"}).Updates(map[string]any{"status": "queued", "scheduled_at": time.Now().UTC(), "error_category": "", "error_code": "", "error_message": "", "version": gorm.Expr("version + 1")})
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected != 1 {
		return nil, biz.ErrPublishPlanConflict
	}
	var p model.PublishTask
	if x := r.data.DB(c).Where("enterprise_id = ? AND id = ?", e, id).First(&p).Error; x != nil {
		return nil, x
	}
	return publishTaskDO(&p), nil
}
func reserveQuota(tx *gorm.DB, e uint64, metric string, amount int64) error {
	var q model.QuotaLimit
	x := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("enterprise_id = ? AND metric = ?", e, metric).First(&q).Error
	if stderrors.Is(x, gorm.ErrRecordNotFound) {
		return nil
	}
	if x != nil {
		return x
	}
	if q.LimitValue > 0 && q.UsedValue+q.ReservedValue+amount > q.LimitValue {
		return biz.ErrPublishQuota
	}
	return tx.Model(&q).Update("reserved_value", gorm.Expr("reserved_value + ?", amount)).Error
}

// settleQuota 把预留配额转为已用配额（任务成功时调用）。
// 语义：reserved_value -= amount; used_value += amount，并写 settle 流水。
// 幂等：通过 idempotencyKey 唯一索引保证不重复结算。
func settleQuota(tx *gorm.DB, e uint64, metric string, amount int64, referenceType string, referenceID uint64, idempotencyKey string) error {
	var q model.QuotaLimit
	x := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("enterprise_id = ? AND metric = ?", e, metric).First(&q).Error
	if stderrors.Is(x, gorm.ErrRecordNotFound) {
		return nil // 未配置额度限制，无需结算
	}
	if x != nil {
		return x
	}
	if err := tx.Model(&q).Updates(map[string]any{
		"reserved_value": gorm.Expr("reserved_value - ?", amount),
		"used_value":     gorm.Expr("used_value + ?", amount),
	}).Error; err != nil {
		return err
	}
	ledger := model.UsageLedger{
		ImmutableTenantModel: model.ImmutableTenantModel{EnterpriseID: e},
		Metric:               metric,
		Operation:            "settle",
		Amount:               amount,
		ReferenceType:        referenceType,
		ReferenceID:          referenceID,
		IdempotencyKey:       idempotencyKey,
		Reason:               "task succeeded",
	}
	return tx.Create(&ledger).Error
}

// releaseQuota 归还预留配额（任务失败/取消时调用）。
// 语义：reserved_value -= amount，并写 rollback 流水。
// 幂等：通过 idempotencyKey 唯一索引保证不重复归还。
func releaseQuota(tx *gorm.DB, e uint64, metric string, amount int64, referenceType string, referenceID uint64, idempotencyKey string) error {
	var q model.QuotaLimit
	x := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("enterprise_id = ? AND metric = ?", e, metric).First(&q).Error
	if stderrors.Is(x, gorm.ErrRecordNotFound) {
		return nil // 未配置额度限制，无需归还
	}
	if x != nil {
		return x
	}
	if err := tx.Model(&q).Update("reserved_value", gorm.Expr("reserved_value - ?", amount)).Error; err != nil {
		return err
	}
	ledger := model.UsageLedger{
		ImmutableTenantModel: model.ImmutableTenantModel{EnterpriseID: e},
		Metric:               metric,
		Operation:            "rollback",
		Amount:               amount,
		ReferenceType:        referenceType,
		ReferenceID:          referenceID,
		IdempotencyKey:       idempotencyKey,
		Reason:               "task failed or cancelled",
	}
	return tx.Create(&ledger).Error
}

// releaseUsedQuota decrements used_value for resource-count quotas (brand/keyword).
// Called when a brand or keyword is deleted to free up the quota slot.
// 幂等：通过 idempotencyKey 唯一索引保证不重复归还。
func releaseUsedQuota(tx *gorm.DB, e uint64, metric string, amount int64, referenceType string, referenceID uint64, idempotencyKey string) error {
	var q model.QuotaLimit
	x := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("enterprise_id = ? AND metric = ?", e, metric).First(&q).Error
	if stderrors.Is(x, gorm.ErrRecordNotFound) {
		return nil // 未配置额度限制，无需归还
	}
	if x != nil {
		return x
	}
	if err := tx.Model(&q).Update("used_value", gorm.Expr("used_value - ?", amount)).Error; err != nil {
		return err
	}
	ledger := model.UsageLedger{
		ImmutableTenantModel: model.ImmutableTenantModel{EnterpriseID: e},
		Metric:               metric,
		Operation:            "rollback",
		Amount:               amount,
		ReferenceType:        referenceType,
		ReferenceID:          referenceID,
		IdempotencyKey:       idempotencyKey,
		Reason:               "resource deleted",
	}
	return tx.Create(&ledger).Error
}
func validatePublishTargetTx(tx *gorm.DB, e uint64, t biz.PublishTargetInput) error {
	var channel model.PublishChannel
	if x := tx.Where("id = ?", t.PublishChannelID).First(&channel).Error; x != nil {
		if stderrors.Is(x, gorm.ErrRecordNotFound) {
			return errors.BadRequest("PUBLISH_PLAN_INVALID", "invalid publish plan: publish channel not found")
		}
		return x
	}
	// 自媒体渠道必须绑定已授权的平台账号；官方媒体/大 V 允许仅指定渠道。
	if channel.Category == model.PublishChannelCategorySelfMedia && t.PlatformAccountID == 0 {
		return errors.BadRequest("PUBLISH_PLAN_INVALID", "invalid publish plan: self media channel requires platform account")
	}
	var g model.EnterpriseChannelGrant
	if x := tx.Where("enterprise_id = ? AND publish_channel_id = ?", e, t.PublishChannelID).First(&g).Error; x != nil {
		if !stderrors.Is(x, gorm.ErrRecordNotFound) {
			return x
		}
		// 未配置企业渠道授权时，自媒体渠道默认对企业可见（依赖平台账号授权即可）。
		g.Enabled = true
	}
	if !g.Enabled {
		return errors.BadRequest("PUBLISH_PLAN_INVALID", "invalid publish plan: enterprise channel grant is disabled")
	}
	if t.PublishTargetID != 0 {
		var target model.PublishTarget
		if x := tx.Where("id = ? AND publish_channel_id = ? AND status = ?", t.PublishTargetID, t.PublishChannelID, model.PublishChannelStatusActive).First(&target).Error; x != nil {
			if stderrors.Is(x, gorm.ErrRecordNotFound) {
				return errors.BadRequest("PUBLISH_PLAN_INVALID", "invalid publish plan: publish target not found")
			}
			return x
		}
	}
	if t.PlatformAccountID != 0 {
		var authorization model.SelfMediaAuthorization
		if x := tx.Where("enterprise_id = ? AND id = ? AND publish_channel_id = ? AND authorization_status = ? AND usage_status = ?", e, t.PlatformAccountID, t.PublishChannelID, biz.AuthorizationStatusActive, biz.AuthorizationUsageEnabled).First(&authorization).Error; x != nil {
			if stderrors.Is(x, gorm.ErrRecordNotFound) {
				return errors.BadRequest("PUBLISH_PLAN_INVALID", "invalid publish plan: platform account authorization not found or not active")
			}
			return x
		}
	}
	return nil
}
func publishPlanDO(p *model.PublishPlan) *biz.PublishPlan {
	do := &biz.PublishPlan{ID: p.ID, EnterpriseID: p.EnterpriseID, Name: p.Name, Status: p.Status, ScheduleType: p.ScheduleType, ScheduledAt: p.ScheduledAt, Timezone: p.Timezone, FailurePolicyJSON: string(p.FailurePolicyJSON), DedupStrategy: p.DedupStrategy, ClientRequestID: p.ClientRequestID, Version: p.Version, CreatedAt: p.CreatedAt}
	if p.ArticleID != nil {
		do.ArticleID = p.ArticleID
	}
	if p.ArticleSnapshotID != nil {
		do.ArticleSnapshotID = p.ArticleSnapshotID
	}
	return do
}
func publishTaskDO(p *model.PublishTask) *biz.PublishTask {
	o := &biz.PublishTask{ID: p.ID, EnterpriseID: p.EnterpriseID, PublishPlanID: p.PublishPlanID, ArticleID: p.ArticleID, PublishChannelID: p.PublishChannelID, ExecutionMode: p.ExecutionMode, Status: p.Status, Priority: p.Priority, ScheduledAt: p.ScheduledAt, AttemptCount: p.AttemptCount, MaxAttempts: p.MaxAttempts, ResultURL: p.ResultURL, PlatformArticleID: p.PlatformArticleID, ErrorCategory: p.ErrorCategory, ErrorCode: p.ErrorCode, ErrorMessage: p.ErrorMessage, CompletedAt: p.CompletedAt, Version: p.Version}
	if p.PublishTargetID != nil {
		o.PublishTargetID = *p.PublishTargetID
	}
	if p.PlatformAccountID != nil {
		o.PlatformAccountID = *p.PlatformAccountID
	}
	return o
}

func (r *publishTaskRepo) ListSucceededTasks(ctx context.Context, e uint64, o biz.PublishTaskListOptions) ([]*biz.PublishTask, int64, error) {
	db := r.data.DB(ctx).Model(&model.PublishTask{}).Where("enterprise_id = ? AND status = ?", e, "succeeded")
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []model.PublishTask
	if err := db.Order("completed_at DESC").Offset(o.Offset).Limit(o.Limit).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	out := make([]*biz.PublishTask, 0, len(rows))
	for _, v := range rows {
		out = append(out, publishTaskDO(&v))
	}
	return out, total, nil
}

func mapPublishTaskError(e error) error {
	if stderrors.Is(e, gorm.ErrRecordNotFound) {
		return biz.ErrPublishPlanNotFound
	}
	if stderrors.Is(e, gorm.ErrDuplicatedKey) {
		return biz.ErrPublishPlanConflict
	}
	return e
}
