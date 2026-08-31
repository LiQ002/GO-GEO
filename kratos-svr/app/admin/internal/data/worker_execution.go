package data

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	stderrors "errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/go-kratos/kratos/v3/errors"
	"github.com/go-sql-driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/data/model"
	"kratos-svr/internal/event"
)

// GEO 监测任务中 AI 平台回答可能耗时 2-3 分钟（如 KIMI 移动端），
// 5 分钟租约时长可覆盖慢响应场景，避免任务被过早回收。
const workerLeaseDuration = 5 * time.Minute

type workerTaskRepo struct{ data *Data }

func NewWorkerTaskRepo(data *Data) biz.WorkerTaskRepo { return &workerTaskRepo{data: data} }

func (r *workerTaskRepo) Register(ctx context.Context, input *biz.WorkerNode) (*biz.WorkerNode, string, error) {
	token, err := secureWorkerToken()
	if err != nil {
		return nil, "", err
	}
	now := time.Now().UTC()
	var saved model.WorkerNode
	err = r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var existing model.WorkerNode
		err := tx.Unscoped().Where("node_id = ?", input.NodeID).First(&existing).Error
		if err == nil {
			updates := map[string]any{
				"name": input.Name, "status": "active", "approval_status": "approved",
				"credential_hash": hashWorkerToken(token), "client_version": input.ClientVersion,
				"capabilities_json": []byte(input.CapabilitiesJSON), "system_info_json": []byte(input.SystemInfoJSON),
				"max_concurrency": max(input.MaxConcurrency, 1), "revoked_at": nil, "deleted_at": nil,
				"version": gorm.Expr("version + 1"), "updated_at": now,
			}
			if err := tx.Unscoped().Model(&existing).Updates(updates).Error; err != nil {
				return err
			}
			return tx.Unscoped().First(&saved, existing.ID).Error
		}
		if !stderrors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		saved = model.WorkerNode{
			SoftDeleteModel: model.SoftDeleteModel{BaseModel: model.BaseModel{CreatedAt: now, UpdatedAt: now}},
			NodeID:          input.NodeID, Name: input.Name, Status: "active", ApprovalStatus: "approved",
			CredentialHash: hashWorkerToken(token), ClientVersion: input.ClientVersion,
			CapabilitiesJSON: []byte(input.CapabilitiesJSON), SystemInfoJSON: []byte(input.SystemInfoJSON),
			MaxConcurrency: max(input.MaxConcurrency, 1), Version: 1,
		}
		return tx.Create(&saved).Error
	})
	if err != nil {
		return nil, "", mapWorkerExecutionError(err)
	}
	return workerDO(&saved), token, nil
}

func (r *workerTaskRepo) Authenticate(ctx context.Context, token string) (*biz.WorkerNode, error) {
	if strings.TrimSpace(token) == "" {
		return nil, biz.ErrWorkerUnauthorized
	}
	var worker model.WorkerNode
	if err := r.data.DB(ctx).Where("credential_hash = ?", hashWorkerToken(token)).First(&worker).Error; err != nil {
		return nil, biz.ErrWorkerUnauthorized
	}
	if worker.Status == "revoked" || worker.RevokedAt != nil {
		return nil, biz.ErrWorkerUnauthorized
	}
	return workerDO(&worker), nil
}

func (r *workerTaskRepo) Heartbeat(ctx context.Context, workerID uint64, clientVersion, capabilitiesJSON, systemInfoJSON string, activeTasks uint32) (*biz.WorkerNode, error) {
	now := time.Now().UTC()
	updates := map[string]any{"last_heartbeat_at": now, "updated_at": now, "version": gorm.Expr("version + 1")}
	if strings.TrimSpace(clientVersion) != "" {
		updates["client_version"] = clientVersion
	}
	if json.Valid([]byte(capabilitiesJSON)) {
		updates["capabilities_json"] = []byte(capabilitiesJSON)
	}
	if json.Valid([]byte(systemInfoJSON)) {
		updates["system_info_json"] = []byte(systemInfoJSON)
	}
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		result := tx.Model(&model.WorkerNode{}).Where("id = ? AND status = ?", workerID, "active").Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return biz.ErrWorkerUnauthorized
		}
		heartbeat := model.WorkerHeartbeat{WorkerNodeID: workerID, ActiveTasks: activeTasks, MetricsJSON: []byte("{}"), ReceivedAt: now}
		return tx.Create(&heartbeat).Error
	})
	if err != nil {
		return nil, mapWorkerExecutionError(err)
	}
	var worker model.WorkerNode
	if err := r.data.DB(ctx).First(&worker, workerID).Error; err != nil {
		return nil, mapWorkerExecutionError(err)
	}
	return workerDO(&worker), nil
}

func (r *workerTaskRepo) Claim(ctx context.Context, worker *biz.WorkerNode, filter biz.TaskClaimFilter) (*biz.TaskLease, error) {
	var output *biz.TaskLease
	var snapshotErr error // 捕获快照构建错误，不回滚事务（任务已标记为 failed）
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		now := time.Now().UTC()
		if err := expireWorkerLeases(tx, now); err != nil {
			return err
		}
		var activeCount int64
		if err := tx.Model(&model.TaskLease{}).Where("worker_node_id = ? AND status = ? AND expires_at > ?", worker.ID, "active", now).Count(&activeCount).Error; err != nil {
			return err
		}
		if activeCount >= int64(max(worker.MaxConcurrency, 1)) {
			return biz.ErrLeaseConflict
		}
		if containsTaskType(filter.TaskTypes, "publish") {
			lease, err := claimPublishTask(tx, worker, filter, now, &snapshotErr)
			if err != nil {
				return err
			}
			output = lease
			return nil
		}
		if containsTaskType(filter.TaskTypes, "geo") {
			lease, err := claimGeoTask(tx, worker, filter, now, &snapshotErr)
			if err != nil {
				return err
			}
			output = lease
			return nil
		}
		return biz.ErrLeaseNotFound
	})
	if err != nil {
		return nil, mapWorkerExecutionError(err)
	}
	if snapshotErr != nil {
		// 快照构建失败时，任务已在事务内标记为 failed（已提交），返回具体错误
		return nil, snapshotErr
	}
	return output, nil
}

func (r *workerTaskRepo) Renew(ctx context.Context, leaseID, version uint64, token string) (*biz.TaskLease, error) {
	now := time.Now().UTC()
	expiresAt := now.Add(workerLeaseDuration)
	result := r.data.DB(ctx).Model(&model.TaskLease{}).
		Where("id = ? AND lease_version = ? AND lease_token_hash = ? AND status = ? AND expires_at > ?", leaseID, version, hashWorkerToken(token), "active", now).
		Updates(map[string]any{"expires_at": expiresAt, "lease_version": gorm.Expr("lease_version + 1")})
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected != 1 {
		return nil, biz.ErrLeaseConflict
	}
	var lease model.TaskLease
	if err := r.data.DB(ctx).First(&lease, leaseID).Error; err != nil {
		return nil, mapWorkerExecutionError(err)
	}
	return &biz.TaskLease{ID: lease.ID, TaskID: lease.TaskID, LeaseVersion: lease.LeaseVersion, TaskType: lease.TaskType, LeaseToken: token, ExpiresAt: lease.ExpiresAt}, nil
}

func (r *workerTaskRepo) Release(ctx context.Context, leaseID uint64, token, reason string) error {
	return r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var lease model.TaskLease
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND lease_token_hash = ? AND status = ?", leaseID, hashWorkerToken(token), "active").First(&lease).Error; err != nil {
			return mapWorkerExecutionError(err)
		}
		now := time.Now().UTC()
		if err := tx.Model(&lease).Updates(map[string]any{"status": "released", "released_at": now, "release_reason": reason}).Error; err != nil {
			return err
		}
		switch lease.TaskType {
		case "geo":
			if err := tx.Model(&model.GEOTask{}).Where("id = ? AND current_lease_id = ? AND status = ?", lease.TaskID, lease.ID, "leased").Updates(map[string]any{"status": "queued", "current_lease_id": nil, "error_category": "worker", "error_code": "LEASE_RELEASED", "error_message": reason, "version": gorm.Expr("version + 1")}).Error; err != nil {
				return err
			}
		default:
			if err := tx.Model(&model.PublishAttempt{}).Where("lease_id = ? AND status = ?", lease.ID, "running").Updates(map[string]any{"status": "released", "finished_at": now, "error_category": "worker", "error_code": "LEASE_RELEASED", "error_message": reason}).Error; err != nil {
				return err
			}
			if err := tx.Model(&model.PublishTask{}).Where("id = ? AND current_lease_id = ? AND status = ?", lease.TaskID, lease.ID, "leased").Updates(map[string]any{"status": "queued", "current_lease_id": nil, "version": gorm.Expr("version + 1")}).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *workerTaskRepo) Report(ctx context.Context, input *biz.TaskResult) error {
	var evt *event.Payload
	var llmCtx *llmContext

	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var lease model.TaskLease
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND task_type = ? AND task_id = ? AND lease_token_hash = ?", input.LeaseID, input.TaskType, input.TaskID, hashWorkerToken(input.LeaseToken)).First(&lease).Error; err != nil {
			return mapWorkerExecutionError(err)
		}
		if lease.Status != "active" {
			return biz.ErrLeaseConflict
		}
		now := time.Now().UTC()
		switch input.TaskType {
		case "geo":
			ge, snapshotID, taskInfo, err := reportGeoTaskResult(tx, r.data, &lease, input, now)
			if err == nil && ge != nil {
				evt = ge
			}
			if err == nil && snapshotID > 0 {
				llmCtx = &llmContext{
					taskID:         taskInfo.id,
					enterpriseID:   taskInfo.enterpriseID,
					brandID:        taskInfo.brandID,
					answerText:     taskInfo.answerText,
					enterpriseName: taskInfo.enterpriseName,
					snapshotID:     snapshotID,
					included:       ge != nil && ge.BrandMentioned,
				}
			}
			return err
		default:
			pe, err := reportPublishTaskResult(tx, &lease, input, now)
			if err == nil && pe != nil {
				evt = pe
			}
			return err
		}
	})
	// 事务提交后发布事件（不阻塞返回，失败仅记日志）
	if err == nil && evt != nil && r.data.broker != nil {
		go func() {
			if perr := r.data.broker.Publish(context.Background(), *evt); perr != nil {
				// 事件推送失败不影响业务，前端轮询兜底
			}
		}()
	}
	// 事务提交后异步执行 LLM 调用（情感分析+竞品提取），避免长耗时 LLM 阻塞 Report 返回
	if err == nil && llmCtx != nil && llmCtx.snapshotID > 0 {
		go func(ctx *llmContext) {
			defer func() {
				if r := recover(); r != nil {
					slog.Error("runPostGeoLLM: panic 恢复", "snapshot_id", ctx.snapshotID, "panic", r)
				}
			}()
			r.runPostGeoLLM(ctx)
		}(llmCtx)
	}
	return err
}

// runPostGeoLLM 在事务提交后执行情感分析和竞品提取的 LLM 调用。
// LLM 结果直接写入数据库，失败不影响主流程（mentions 已有 neutral 默认值）。
func (r *workerTaskRepo) runPostGeoLLM(ctx *llmContext) {
	if r.data == nil || r.data.box == nil {
		return
	}
	db := r.data.DB(context.Background())

	// 加载品牌词
	var brand model.Brand
	if err := db.Where("enterprise_id = ? AND id = ?", ctx.enterpriseID, ctx.brandID).First(&brand).Error; err != nil {
		slog.Warn("runPostGeoLLM: 加载品牌失败", "error", err)
		return
	}
	brandTerms := dedupeNonEmpty(append([]string{brand.Name}, jsonArrayStrings(brand.AliasesJSON)...))
	if ctx.enterpriseName != "" {
		brandTerms = append(brandTerms, ctx.enterpriseName)
	}

	hasSentiment := enterpriseHasSentimentFeature(db, ctx.enterpriseID)
	hasCompetitor := enterpriseHasCompetitorFeature(db, ctx.enterpriseID)
	slog.Info("runPostGeoLLM: 启动",
		"snapshot_id", ctx.snapshotID,
		"enterprise_id", ctx.enterpriseID,
		"included", ctx.included,
		"has_sentiment_feature", hasSentiment,
		"has_competitor_feature", hasCompetitor,
		"answer_len", len(ctx.answerText))

	// 情感分析：仅收录成功时触发
	if ctx.included && hasSentiment {
		sentiment := analyzeSentiment(db, r.data, ctx.answerText, brandTerms, ctx.enterpriseName)
		slog.Info("runPostGeoLLM: 情感分析完成", "snapshot_id", ctx.snapshotID, "sentiment", sentiment)
		// 更新 brand/enterprise mention 的情感
		if err := db.Table(model.TableMentions).
			Where("answer_snapshot_id = ? AND entity_type IN ?", ctx.snapshotID, []string{"brand", "enterprise"}).
			Update("sentiment", sentiment).Error; err != nil {
			slog.Warn("runPostGeoLLM: 更新情感失败", "error", err, "snapshot_id", ctx.snapshotID)
		}
	}

	// 竞品提取：不管收录与否都调用
	if hasCompetitor {
		// 防重：如果该 snapshot 已有 competitor mentions，跳过（避免 worker 重试导致重复写入）
		var existingCompCount int64
		db.Table(model.TableMentions).
			Where("answer_snapshot_id = ? AND entity_type = ?", ctx.snapshotID, "competitor").
			Count(&existingCompCount)
		if existingCompCount > 0 {
			slog.Info("runPostGeoLLM: 竞品 mentions 已存在，跳过", "snapshot_id", ctx.snapshotID, "existing", existingCompCount)
			return
		}
		competitors := extractCompetitorsByLLM(db, r.data, ctx.answerText, brandTerms, ctx.enterpriseName)
		slog.Info("runPostGeoLLM: 竞品提取完成", "snapshot_id", ctx.snapshotID, "competitor_count", len(competitors), "competitors", competitors)
		answerLower := strings.ToLower(ctx.answerText)
		now := time.Now().UTC()
		for i, name := range competitors {
			rank := uint32(i + 1)
			if rank > 5 {
				break
			}
			pos := uint32(strings.Index(answerLower, strings.ToLower(name)))
			mention := model.Mention{
				ImmutableTenantModel: model.ImmutableTenantModel{EnterpriseID: ctx.enterpriseID, CreatedAt: now},
				AnswerSnapshotID:     ctx.snapshotID,
				EntityType:           "competitor",
				EntityID:             0,
				Text:                 name,
				Position:             pos,
				Rank:                 rank,
				Sentiment:            "neutral",
				Confidence:           0.7,
			}
			if err := db.Create(&mention).Error; err != nil {
				slog.Warn("runPostGeoLLM: 创建竞品 mention 失败", "error", err, "name", name)
			}
		}
	}
}

func reportPublishTaskResult(tx *gorm.DB, lease *model.TaskLease, input *biz.TaskResult, now time.Time) (*event.Payload, error) {
	var attempt model.PublishAttempt
	if err := tx.Where("lease_id = ?", lease.ID).First(&attempt).Error; err != nil {
		return nil, err
	}
	if lease.Status != "active" {
		if attempt.Status == input.Status && string(attempt.ResultJSON) == input.ResultJSON && string(attempt.EvidenceJSON) == input.EvidenceJSON {
			return nil, nil
		}
		return nil, biz.ErrLeaseConflict
	}
	resultURL, platformArticleID := publishResultIdentifiers(input.ResultJSON)
	taskStatus := input.Status
	if taskStatus == "draft_saved" {
		taskStatus = "manual_action_required"
	}
	if taskStatus != "succeeded" && taskStatus != "failed" && taskStatus != "manual_action_required" {
		return nil, biz.ErrWorkerInvalid
	}
	attemptUpdates := map[string]any{
		"status": taskStatus, "finished_at": now, "duration_ms": input.DurationMS,
		"result_json": []byte(input.ResultJSON), "evidence_json": []byte(input.EvidenceJSON),
		"error_category": input.ErrorCategory, "error_code": input.ErrorCode,
		"error_message": input.ErrorMessage, "client_version": input.ClientVersion,
	}
	if err := tx.Model(&attempt).Updates(attemptUpdates).Error; err != nil {
		return nil, err
	}
	var task model.PublishTask
	if err := tx.Model(&model.PublishTask{}).Where("id = ? AND current_lease_id = ?", input.TaskID, lease.ID).Updates(map[string]any{
		"status": taskStatus, "result_url": resultURL, "platform_article_id": platformArticleID,
		"error_category": input.ErrorCategory, "error_code": input.ErrorCode, "error_message": input.ErrorMessage,
		"completed_at": now, "current_lease_id": nil, "version": gorm.Expr("version + 1"),
	}).Error; err != nil {
		return nil, err
	}
	if err := tx.Model(lease).Updates(map[string]any{"status": "completed", "released_at": now, "release_reason": "result_reported"}).Error; err != nil {
		return nil, err
	}
	// 加载 task 的 enterprise_id 用于计费结算（Updates 不会回填字段）。
	if task.EnterpriseID == 0 {
		if err := tx.Select("enterprise_id").First(&task, input.TaskID).Error; err != nil {
			return nil, err
		}
	}
	// 计费闭环：根据任务终态 settle 或 release 预留配额。
	// succeeded → settle（reserved 转 used）；failed/manual_action_required → release（归还 reserved）。
	// 幂等键用 task ID 保证不重复结算/归还。
	if taskStatus == "succeeded" {
		if err := settleQuota(tx, task.EnterpriseID, "publish_tasks", 1, "publish_task", task.ID, fmt.Sprintf("publish-task-settle:%d", task.ID)); err != nil {
			return nil, err
		}
	} else {
		if err := releaseQuota(tx, task.EnterpriseID, "publish_tasks", 1, "publish_task", task.ID, fmt.Sprintf("publish-task-release:%d", task.ID)); err != nil {
			return nil, err
		}
	}
	// 投放成功后仅记录 published_at，保持文章状态为 normal，
	// 这样同一篇文章可继续投放到其他平台（依赖 pub_tasks 去重策略做精细控制）。
	// 与迁移 000033_simplify_article_status 的设计意图对齐，避免文章状态死锁。
	// 注意：不再要求 resultURL 非空，因为许多平台发布成功后并不返回 URL。
	if taskStatus == "succeeded" {
		if err := tx.First(&task, input.TaskID).Error; err != nil {
			return nil, err
		}
		var snapshot model.ArticleSnapshot
		if err := tx.First(&snapshot, task.ArticleSnapshotID).Error; err != nil {
			return nil, err
		}
		if err := tx.Model(&model.Article{}).Where("enterprise_id = ? AND id = ? AND status = ?", task.EnterpriseID, snapshot.ArticleID, "normal").Updates(map[string]any{"published_at": now, "version": gorm.Expr("version + 1")}).Error; err != nil {
			return nil, err
		}
	}
	// 投放任务完成后检查所属 plan 是否所有 task 都已进入终态，
	// 若是则将 plan 状态转为 completed（值=6，对应 user biz.PublishPlanStatusCompleted），
	// 解决"计划永远停留在执行中"的问题。
	if err := maybeCompletePublishPlan(tx, input.TaskID, now); err != nil {
		return nil, err
	}
	return &event.Payload{
		Type:         event.TypePublishTaskCompleted,
		EnterpriseID: task.EnterpriseID,
		TaskID:       input.TaskID,
		Status:       taskStatus,
	}, nil
}

// maybeCompletePublishPlan 检查指定 task 所属 plan 是否所有 task 都进入终态。
// 终态：succeeded / failed / manual_action_required / cancelled / expired
// 非终态：queued / leased / retry_wait / running
func maybeCompletePublishPlan(tx *gorm.DB, taskID uint64, now time.Time) error {
	var task model.PublishTask
	if err := tx.Select("publish_plan_id").First(&task, taskID).Error; err != nil {
		return err
	}
	// 仅当 plan 当前处于 active(2) 时才自动转 completed，避免覆盖 paused/stopped/cancelled
	var plan model.PublishPlan
	if err := tx.Where("id = ? AND status = ?", task.PublishPlanID, 2).First(&plan).Error; err != nil {
		if stderrors.Is(err, gorm.ErrRecordNotFound) {
			return nil // plan 不存在或非 active，无需处理
		}
		return err
	}
	// 统计非终态 task 数量
	var pendingCount int64
	if err := tx.Model(&model.PublishTask{}).
		Where("publish_plan_id = ? AND status IN ?", task.PublishPlanID, []string{"queued", "leased", "retry_wait", "running"}).
		Count(&pendingCount).Error; err != nil {
		return err
	}
	if pendingCount > 0 {
		return nil // 仍有任务在执行中
	}
	// 所有 task 已终态，将 plan 转为 completed(6)
	return tx.Model(&model.PublishPlan{}).
		Where("id = ? AND version = ?", plan.ID, plan.Version).
		Updates(map[string]any{"status": 6, "version": gorm.Expr("version + 1")}).Error
}

// llmContext 保存事务中计算的信息，用于事务后 LLM 调用。
type llmContext struct {
	taskID         uint64
	enterpriseID   uint64
	brandID        uint64
	answerText     string
	enterpriseName string
	snapshotID     uint64
	included       bool
}

// geoTaskInfo 保存事务中计算的信息，用于事务后 LLM 调用。
type geoTaskInfo struct {
	id             uint64
	enterpriseID   uint64
	brandID        uint64
	answerText     string
	enterpriseName string
}

func reportGeoTaskResult(tx *gorm.DB, data *Data, lease *model.TaskLease, input *biz.TaskResult, now time.Time) (*event.Payload, uint64, geoTaskInfo, error) {
	emptyInfo := geoTaskInfo{}
	taskStatus := input.Status
	if taskStatus != "succeeded" && taskStatus != "failed" && taskStatus != "manual_action_required" {
		return nil, 0, emptyInfo, biz.ErrWorkerInvalid
	}
	var task model.GEOTask
	if err := tx.First(&task, input.TaskID).Error; err != nil {
		return nil, 0, emptyInfo, err
	}
	if err := tx.Model(&task).Updates(map[string]any{
		"status": taskStatus, "error_category": input.ErrorCategory, "error_code": input.ErrorCode,
		"error_message": input.ErrorMessage, "completed_at": now, "current_lease_id": nil,
		"version": gorm.Expr("version + 1"),
	}).Error; err != nil {
		return nil, 0, emptyInfo, err
	}
	if err := tx.Model(lease).Updates(map[string]any{"status": "completed", "released_at": now, "release_reason": "result_reported"}).Error; err != nil {
		return nil, 0, emptyInfo, err
	}
	// 计费闭环：根据任务终态 settle 或 release 预留配额。
	// succeeded → settle（reserved 转 used）；failed/manual_action_required → release（归还 reserved）。
	if taskStatus == "succeeded" {
		if err := settleQuota(tx, task.EnterpriseID, "geo_queries", 1, "geo_task", task.ID, fmt.Sprintf("geo-task-settle:%d", task.ID)); err != nil {
			return nil, 0, emptyInfo, err
		}
	} else {
		if err := releaseQuota(tx, task.EnterpriseID, "geo_queries", 1, "geo_task", task.ID, fmt.Sprintf("geo-task-release:%d", task.ID)); err != nil {
			return nil, 0, emptyInfo, err
		}
	}
	if taskStatus != "succeeded" {
		return &event.Payload{
			Type: event.TypeGeoTaskCompleted, EnterpriseID: task.EnterpriseID,
			TaskID: task.ID, Status: taskStatus,
		}, 0, emptyInfo, nil
	}
	var result geoTaskResult
	if err := json.Unmarshal([]byte(input.ResultJSON), &result); err != nil {
		return nil, 0, emptyInfo, err
	}
	snapshot := model.AnswerSnapshot{
		ImmutableTenantModel: model.ImmutableTenantModel{EnterpriseID: task.EnterpriseID, CreatedAt: now},
		GEOTaskID:            task.ID,
		AttemptID:            lease.ID,
		InclusionSiteID:      task.InclusionSiteID,
		ModelEntry:           task.ModelEntry,
		QuestionText:         result.QuestionText,
		AnswerText:           result.AnswerText,
		AnswerStatus:         result.AnswerStatus,
		ScreenshotKey:        result.ScreenshotKey,
		EvidenceJSON:         []byte(input.EvidenceJSON),
		// 截断保护：session_ref 列为 varchar(2048)，极端长 URL（如文心 extParams 重复）仍可能超限
		SessionRef:    truncateSessionRef(result.SessionRef),
		ObservedAt:    result.ObservedAt,
		ContentHash:   hashContent(result.AnswerText),
		ClientVersion: input.ClientVersion,
	}
	if snapshot.ObservedAt.IsZero() {
		snapshot.ObservedAt = now
	}
	if snapshot.AnswerStatus == "" {
		snapshot.AnswerStatus = "valid"
	}
	if err := tx.Create(&snapshot).Error; err != nil {
		return nil, 0, emptyInfo, err
	}
	for i := range result.Citations {
		c := &result.Citations[i]
		cite := model.Citation{
			ImmutableTenantModel: model.ImmutableTenantModel{EnterpriseID: task.EnterpriseID, CreatedAt: now},
			AnswerSnapshotID:     snapshot.ID,
			// 截断保护：Kimi 等平台 URL 带 #:~:text= fragment 可达 KB 级，远超 varchar(2048)。
			// truncateCitationURL 会先剥离 fragment（无价值的高亮参数），再截断。
			URL:                truncateCitationURL(c.URL),
			Domain:             c.Domain,
			Title:              c.Title,
			Position:           uint32(i + 1),
			IsEnterpriseSource: c.IsEnterpriseSource,
		}
		if c.ArticleID != 0 {
			cite.ArticleID = &c.ArticleID
		}
		if c.MetadataJSON != "" {
			cite.MetadataJSON = []byte(c.MetadataJSON)
		}
		if err := tx.Create(&cite).Error; err != nil {
			return nil, 0, emptyInfo, err
		}
	}

	// 匹配引用 URL 与企业已发布文章：
	// 从 pub_tasks 加载企业已发布文章的 URL，反向匹配刚保存的引用，
	// 把 article_id 写入 geo_citations，供信源分析 Top10 使用。
	if err := matchCitationsToArticles(tx, task.EnterpriseID, snapshot.ID); err != nil {
		slog.Warn("match citations to articles failed", "error", err, "enterprise_id", task.EnterpriseID)
	}

	// 收录验证规则在后端执行（v2）：客户端只负责抓取原始回答 + 引用，
	// 品牌词 / 企业名称的匹配、提及列表、分析评分全部在后端计算。
	// 注意：LLM 调用（情感分析+竞品提取）在 computeGeoAnalysis 之后由 postGeoLLMProcessing 执行，
	// 避免长耗时 LLM 调用导致数据库事务超时回滚。
	mentions, analysis := computeGeoAnalysis(tx, data, &task, result.AnswerText, result.Citations, now)
	for i := range mentions {
		mentions[i].AnswerSnapshotID = snapshot.ID
		if err := tx.Create(&mentions[i]).Error; err != nil {
			return nil, 0, emptyInfo, err
		}
	}
	if analysis != nil {
		analysis.AnswerSnapshotID = snapshot.ID
		if err := tx.Create(analysis).Error; err != nil {
			return nil, 0, emptyInfo, err
		}
	}

	// 获取企业名称用于事务后 LLM 调用
	var enterprise model.Enterprise
	enterpriseName := ""
	if err := tx.Where("id = ?", task.EnterpriseID).First(&enterprise).Error; err == nil {
		enterpriseName = enterprise.Name
	}

	info := geoTaskInfo{
		id:             task.ID,
		enterpriseID:   task.EnterpriseID,
		brandID:        task.BrandID,
		answerText:     result.AnswerText,
		enterpriseName: enterpriseName,
	}
	return &event.Payload{
		Type: event.TypeGeoTaskCompleted, EnterpriseID: task.EnterpriseID,
		TaskID: task.ID, Status: taskStatus, BrandMentioned: analysis != nil && analysis.BrandMentioned,
	}, snapshot.ID, info, nil
}

// computeGeoAnalysis 执行收录验证规则：加载品牌（名称 + 别名 + 官方域名）
// 和企业名称，在 AI 回答文本和引用来源中搜索是否出现品牌词或企业名称。
// 品牌或企业名称任意出现即算收录成功（brand_mentioned=true）。
// 若有品牌/企业提及且配置了情感分析用途的写作模型，调用 LLM 判定情感倾向；
// 否则 sentiment 保持 neutral。返回 mentions 列表和 analysis 结果。
func computeGeoAnalysis(tx *gorm.DB, data *Data, task *model.GEOTask, answerText string, citations []geoCitationResult, now time.Time) ([]model.Mention, *model.AnalysisResult) {
	enterpriseID := task.EnterpriseID
	base := model.ImmutableTenantModel{EnterpriseID: enterpriseID, CreatedAt: now}

	// 加载品牌
	var brand model.Brand
	if err := tx.Where("enterprise_id = ? AND id = ?", enterpriseID, task.BrandID).First(&brand).Error; err != nil {
		return nil, &model.AnalysisResult{
			ImmutableTenantModel: base,
			AnalysisVersion:      1,
			RuleVersion:          "v2",
			Status:               "completed",
			BrandMentioned:       false,
			EnterpriseCited:      false,
			VisibilityScore:      0.1,
			AccuracyScore:        0.3,
			Confidence:           0.5,
			ResultJSON:           []byte(`{"error":"brand not found"}`),
		}
	}

	// 加载企业名称
	var enterprise model.Enterprise
	enterpriseName := ""
	if err := tx.Where("id = ?", enterpriseID).First(&enterprise).Error; err == nil {
		enterpriseName = enterprise.Name
	}

	// 构建搜索词列表：品牌名 + 品牌别名（去重、去空）
	brandTerms := dedupeNonEmpty(append([]string{brand.Name}, jsonArrayStrings(brand.AliasesJSON)...))

	answerLower := strings.ToLower(answerText)
	slog.Info("computeGeoAnalysis: 收录判定开始",
		"enterprise_id", enterpriseID, "brand_id", task.BrandID,
		"brand_name", brand.Name, "enterprise_name", enterpriseName,
		"brand_terms", brandTerms,
		"answer_text_len", len(answerText), "answer_preview", truncateForLog(answerText, 200))

	var mentions []model.Mention
	brandMentioned := false
	enterpriseMentioned := false

	// 在回答文本中搜索（大小写不敏感）
	// 一个品牌词/企业名在正文中出现 N 次就写 N 条 mention 记录，
	// 这样"提及次数"（COUNT(*)）能反映真实曝光频次；
	// "提及率"（COUNT(DISTINCT answer_snapshot_id)）仍是一条回答算 1 次。
	for _, term := range brandTerms {
		if term == "" {
			continue
		}
		termLower := strings.ToLower(term)
		start := 0
		for {
			idx := strings.Index(answerLower[start:], termLower)
			if idx < 0 {
				break
			}
			pos := start + idx
			mentions = append(mentions, model.Mention{
				ImmutableTenantModel: base,
				EntityType:           "brand",
				EntityID:             task.BrandID,
				Text:                 term,
				Position:             uint32(pos),
				Sentiment:            "neutral",
				Confidence:           0.85,
			})
			brandMentioned = true
			start = pos + len(termLower)
		}
	}
	if enterpriseName != "" {
		entNameLower := strings.ToLower(enterpriseName)
		start := 0
		for {
			idx := strings.Index(answerLower[start:], entNameLower)
			if idx < 0 {
				break
			}
			pos := start + idx
			mentions = append(mentions, model.Mention{
				ImmutableTenantModel: base,
				EntityType:           "enterprise",
				EntityID:             enterpriseID,
				Text:                 enterpriseName,
				Position:             uint32(pos),
				Sentiment:            "neutral",
				Confidence:           0.85,
			})
			enterpriseMentioned = true
			start = pos + len(entNameLower)
		}
	}

	// 联系方式曝光检测：与企业填写的联系电话（contact_phone）严格匹配。
	// 命中条件：AI 回答文本中出现与企业 contact_phone 完全一致的内容。
	// 为应对格式差异（如 010-12345678 vs 01012345678），做归一化匹配：剥除空格、横线、括号后再比对。
	// 不再用宽松的电话号码正则，避免误把无关电话号码算作本企业的联系方式曝光。
	enterpriseContacts := dedupeNonEmpty([]string{
		strings.TrimSpace(enterprise.ContactPhone),
	})
	answerNormalized := normalizeContactForMatch(answerText)
	answerLowerNormalized := strings.ToLower(answerNormalized)
	for _, contact := range enterpriseContacts {
		contactNormalized := strings.ToLower(normalizeContactForMatch(contact))
		if contactNormalized == "" {
			continue
		}
		if idx := strings.Index(answerLowerNormalized, contactNormalized); idx >= 0 {
			mentions = append(mentions, model.Mention{
				ImmutableTenantModel: base,
				EntityType:           "contact",
				EntityID:             enterpriseID,
				Text:                 contact,
				// 用归一化后字符串的位置（非原始字节偏移），主要用于存在性标记，
				// 不在前端高亮展示中按 position 取原文，故归一化偏移可接受。
				Position:   uint32(idx),
				Sentiment:  "neutral",
				Confidence: 1.0, // 严格匹配置信度更高
			})
			// 一条回答里同一联系方式只计一次曝光
			break
		}
	}

	// 引用来源判定：引用 URL 或标题匹配企业已发布文章才算收录
	// 加载企业已发布文章的 URL 和标题，构建索引（与 matchCitationsToArticles 相同的 URL 匹配策略）
	type pubArticle struct {
		ResultURL string `gorm:"column:result_url"`
		Title     string `gorm:"column:title"`
	}
	var pubArticles []pubArticle
	_ = tx.Table(model.TablePublishTasks+" AS pt").
		Joins("JOIN "+model.TableArticles+" AS a ON a.id = pt.article_id").
		Select("pt.result_url, a.title").
		Where("pt.enterprise_id = ? AND pt.status = 'succeeded' AND pt.deleted_at IS NULL AND pt.result_url != '' AND pt.result_url IS NOT NULL", enterpriseID).
		Scan(&pubArticles).Error

	pubExactURL := make(map[string]bool, len(pubArticles))
	pubNormURL := make(map[string]bool, len(pubArticles))
	pubTitleMap := make(map[string]bool, len(pubArticles))
	for _, p := range pubArticles {
		if isPlatformManagementURL(p.ResultURL) {
			continue
		}
		pubExactURL[p.ResultURL] = true
		pubNormURL[normalizeURL(p.ResultURL)] = true
		t := strings.ToLower(strings.TrimSpace(p.Title))
		if t != "" {
			pubTitleMap[t] = true
		}
	}

	// 引用来源命中判定：URL 精确/去参匹配 或 标题精确匹配
	enterpriseCited := false
	for _, cite := range citations {
		citeURL := strings.TrimSpace(cite.URL)
		citeTitleLower := strings.ToLower(strings.TrimSpace(cite.Title))

		// URL 匹配（精确 + 去参）
		if citeURL != "" && (pubExactURL[citeURL] || pubNormURL[normalizeURL(citeURL)]) {
			brandMentioned = true
			enterpriseCited = true
			break
		}
		// 标题精确匹配
		if citeTitleLower != "" && pubTitleMap[citeTitleLower] {
			brandMentioned = true
			enterpriseCited = true
			break
		}
	}

	// 官方域名出现在回答文本中也算企业被引用
	if brand.OfficialDomain != "" && strings.Contains(answerLower, strings.ToLower(brand.OfficialDomain)) {
		enterpriseCited = true
	}

	// 收录判定：品牌词或企业名称任意出现即收录
	included := brandMentioned || enterpriseMentioned || enterpriseCited

	// 联系方式曝光：回答中是否出现电话号码格式
	contactMentioned := false
	for _, m := range mentions {
		if m.EntityType == "contact" {
			contactMentioned = true
			break
		}
	}

	// 品牌排名：扫描品牌词在回答中的全部出现位置，取第一个所在行
	// 行首带列表序号（"1." / "2、" 等）的出现，解析其序号作为排名。
	// 品牌首次出现常在标题/概述中（无序号），推荐列表中的后续出现才
	// 带序号，因此不能只看首个提及位置。无序号返回 0（无法判定排名，
	// 不计入 TOP3）。
	brandRank := brandRankInText(answerText, brandTerms)

	// 可见度评分（visibility_score，0-1.0）：衡量品牌在 AI 回答中的综合曝光程度。
	// 维度：收录门槛 + 品牌提及频次 + 品牌排名 + 企业名/官网被引用。
	visibilityScore, visibilityBreakdown := computeVisibilityScore(
		included, len(mentions), brandRank, enterpriseMentioned, enterpriseCited)

	// 准确度评分（accuracy_score，0-1.0）：衡量 AI 对企业品牌信息表述的准确与完整程度。
	// 维度：回答充分性 + 品牌名精确 + 信源引用 + 回答结构 + 引用数量。
	accuracyScore, accuracyBreakdown := computeAccuracyScore(
		answerText, brandMentioned, enterpriseMentioned, enterpriseCited, len(citations))

	resultJSON, _ := json.Marshal(map[string]any{
		"brandMentioned":      brandMentioned,
		"enterpriseMentioned": enterpriseMentioned,
		"enterpriseCited":     enterpriseCited,
		"contactMentioned":    contactMentioned,
		"included":            included,
		"brandTerms":          brandTerms,
		"enterpriseName":      enterpriseName,
		"citationCount":       len(citations),
		"mentionCount":        len(mentions),
		"brandRank":           brandRank,
		"visibilityScore":     visibilityScore,
		"visibilityBreakdown": visibilityBreakdown,
		"accuracyScore":       accuracyScore,
		"accuracyBreakdown":   accuracyBreakdown,
	})

	analysis := &model.AnalysisResult{
		ImmutableTenantModel: base,
		AnalysisVersion:      1,
		RuleVersion:          "v2",
		Status:               "completed",
		BrandMentioned:       included,
		EnterpriseCited:      enterpriseCited,
		VisibilityScore:      visibilityScore,
		AccuracyScore:        accuracyScore,
		Confidence:           0.85,
		ResultJSON:           resultJSON,
	}

	// 情感分析和竞品提取的 LLM 调用已移至 postGeoLLMProcessing 函数，
	// 在数据库事务提交后执行，避免长耗时 LLM 调用导致事务超时回滚。
	slog.Info("computeGeoAnalysis: 收录判定结果",
		"brand_mentioned", brandMentioned, "enterprise_mentioned", enterpriseMentioned,
		"enterprise_cited", enterpriseCited, "included", included,
		"mention_count", len(mentions),
		"visibility_score", visibilityScore, "accuracy_score", accuracyScore,
		"brand_rank", brandRank)

	return mentions, analysis
}

// computeVisibilityScore 计算可见度评分（0-1.0）。
// 衡量品牌在 AI 回答中的综合曝光程度：
//   - 收录门槛（基础分）：未收录 0.1，已收录 0.4
//   - 品牌提及频次：每次 +0.05，上限 +0.20
//   - 品牌排名：TOP1 +0.20 / TOP2 +0.15 / TOP3 +0.10 / 其他 +0.05 / 无序号 0
//   - 企业名被提及：+0.10
//   - 企业官网/文章被引用：+0.10
//
// 总分上限 1.0。
func computeVisibilityScore(included bool, mentionCount, brandRank int, enterpriseMentioned, enterpriseCited bool) (float64, map[string]float64) {
	base := 0.1
	if included {
		base = 0.4
	}
	mentionBonus := min(float64(mentionCount)*0.05, 0.20)
	rankBonus := 0.0
	switch {
	case brandRank == 1:
		rankBonus = 0.20
	case brandRank == 2:
		rankBonus = 0.15
	case brandRank == 3:
		rankBonus = 0.10
	case brandRank > 3:
		rankBonus = 0.05
	}
	enterpriseBonus := 0.0
	if enterpriseMentioned {
		enterpriseBonus += 0.10
	}
	if enterpriseCited {
		enterpriseBonus += 0.10
	}
	score := min(base+mentionBonus+rankBonus+enterpriseBonus, 1.0)
	breakdown := map[string]float64{
		"base":            base,
		"mentionBonus":    mentionBonus,
		"rankBonus":       rankBonus,
		"enterpriseBonus": enterpriseBonus,
	}
	return score, breakdown
}

// computeAccuracyScore 计算准确度评分（0-1.0）。
// 衡量 AI 对企业品牌信息表述的准确与完整程度：
//   - 回答充分性：< 50 字 0.2，>= 50 字 0.4
//   - 品牌名精确出现：+0.15
//   - 企业官网/文章被引用：+0.15
//   - 企业名被提及：+0.10
//   - 回答结构完整（含表格/列表/标题）：+0.10
//   - 引用数 >= 3（信源充足）：+0.10
//
// 总分上限 1.0。
func computeAccuracyScore(answerText string, brandMentioned, enterpriseMentioned, enterpriseCited bool, citationCount int) (float64, map[string]float64) {
	base := 0.2
	if len(answerText) >= 50 {
		base = 0.4
	}
	brandBonus := 0.0
	if brandMentioned {
		brandBonus = 0.15
	}
	citationBonus := 0.0
	if enterpriseCited {
		citationBonus = 0.15
	}
	enterpriseBonus := 0.0
	if enterpriseMentioned {
		enterpriseBonus = 0.10
	}
	structureBonus := 0.0
	lower := strings.ToLower(answerText)
	if strings.Contains(answerText, "|") || strings.Contains(answerText, "\n#") ||
		strings.Contains(lower, "\n- ") || strings.Contains(lower, "\n* ") ||
		strings.Contains(answerText, "\n1.") || strings.Contains(answerText, "\n1、") {
		structureBonus = 0.10
	}
	sourceBonus := 0.0
	if citationCount >= 3 {
		sourceBonus = 0.10
	}
	score := min(base+brandBonus+citationBonus+enterpriseBonus+structureBonus+sourceBonus, 1.0)
	breakdown := map[string]float64{
		"base":            base,
		"brandBonus":      brandBonus,
		"citationBonus":   citationBonus,
		"enterpriseBonus": enterpriseBonus,
		"structureBonus":  structureBonus,
		"sourceBonus":     sourceBonus,
	}
	return score, breakdown
}

// truncateForLog 截断字符串用于日志输出，避免过长日志。
func truncateForLog(s string, maxLen int) string {
	runes := []rune(s)
	if len(runes) <= maxLen {
		return s
	}
	return string(runes[:maxLen]) + "..."
}

// enterpriseHasSentimentFeature 检查企业当前活跃订阅所属套餐是否启用了"情感分析"功能。
// 查询路径：ent_subscriptions(status='active', expires_at>NOW()) → plan_id → ent_plan_features(feature=6, enabled=true)
// 无活跃订阅或未配置 feature 时返回 false。
func enterpriseHasSentimentFeature(tx *gorm.DB, enterpriseID uint64) bool {
	var count int64
	err := tx.Table(model.TableSubscriptions+" AS sub").
		Joins("JOIN "+model.TablePlanFeatures+" AS pf ON pf.plan_id = sub.plan_id").
		Where("sub.enterprise_id = ? AND sub.status = ? AND sub.expires_at > NOW() AND pf.feature = ? AND pf.enabled = ?",
			enterpriseID, "active", model.PlanFeatureSentimentAnalysis, true).
		Count(&count).Error
	if err != nil {
		return false
	}
	return count > 0
}

// enterpriseHasCompetitorFeature 检查企业当前活跃订阅所属套餐是否启用了"竞品分析"功能。
// 查询路径同 enterpriseHasSentimentFeature，feature=7 (PlanFeatureCompetitorAnalysis)。
func enterpriseHasCompetitorFeature(tx *gorm.DB, enterpriseID uint64) bool {
	var count int64
	err := tx.Table(model.TableSubscriptions+" AS sub").
		Joins("JOIN "+model.TablePlanFeatures+" AS pf ON pf.plan_id = sub.plan_id").
		Where("sub.enterprise_id = ? AND sub.status = ? AND sub.expires_at > NOW() AND pf.feature = ? AND pf.enabled = ?",
			enterpriseID, "active", model.PlanFeatureCompetitorAnalysis, true).
		Count(&count).Error
	if err != nil {
		return false
	}
	return count > 0
}

// extractCompetitorsByLLM 调用 LLM 从 AI 回答中提取竞品品牌/公司名。
// 返回按出现顺序排列的竞品名列表（已排除本品牌词），最多 5 个。
// LLM 不可用或调用失败时返回 nil。
func extractCompetitorsByLLM(tx *gorm.DB, data *Data, answerText string, brandTerms []string, enterpriseName string) []string {
	if answerText == "" {
		return nil
	}

	// 查询配置了竞品分析用途的活跃模型（按 sort_order 优先）
	var wm model.WritingModel
	err := tx.Table(model.TableWritingModels+" AS m").
		Joins("JOIN "+model.TableWritingModelPurposes+" AS p ON p.writing_model_id = m.id").
		Where("p.purpose = ? AND m.status = ? AND m.deleted_at IS NULL",
			model.WritingModelPurposeCompetitorAnalysis, model.WritingModelStatusActive).
		Order("m.sort_order ASC, m.id ASC").
		First(&wm).Error
	if err != nil {
		slog.Warn("extractCompetitorsByLLM: 查询竞品分析模型失败", "err", err)
		return nil
	}
	slog.Info("extractCompetitorsByLLM: 使用模型", "id", wm.ID, "display_name", wm.DisplayName, "model_id", wm.ModelID, "sort_order", wm.SortOrder)

	// 查询凭据
	var cred model.WritingModelCredential
	if err := tx.Where("writing_model_id = ?", wm.ID).First(&cred).Error; err != nil {
		slog.Warn("extractCompetitorsByLLM: 查询凭据失败", "err", err)
		return nil
	}

	// 解密 API key
	apiKeyBytes, err := data.openCredential(cred.Nonce, cred.Ciphertext,
		[]byte(fmt.Sprintf("writing-model:%d", wm.ID)))
	if err != nil {
		slog.Warn("extractCompetitorsByLLM: 解密 API key 失败", "err", err)
		return nil
	}
	apiKey := string(apiKeyBytes)
	defer func() {
		for i := range apiKeyBytes {
			apiKeyBytes[i] = 0
		}
	}()

	// 构建本品牌排除词
	ownTerms := dedupeNonEmpty(append(brandTerms, enterpriseName))
	ownTermsStr := strings.Join(ownTerms, "、")

	result := callLLMForCompetitorExtraction(wm.BaseURL, wm.ModelID, apiKey, answerText, ownTermsStr, wm.TimeoutSeconds)
	slog.Debug("extractCompetitorsByLLM: LLM 调用完成", "competitors", result)
	return result
}

// callLLMForCompetitorExtraction 以 OpenAI compatible 协议调用 LLM 提取竞品品牌名。
// 返回按出现顺序排列的竞品名列表，失败时返回 nil。
func callLLMForCompetitorExtraction(baseURL, modelID, apiKey, answerText, ownTerms string, timeoutSec uint32) []string {
	systemPrompt := "你是品牌竞品分析专家。从AI回答中提取所有被提及的企业/品牌名称。只返回JSON，不要输出思考过程或任何解释。"
	userPrompt := fmt.Sprintf(`从以下AI回答中提取所有被提及的企业/品牌名称。

提取规则：
1. 提取完整企业名或品牌名（如"吉林森工集团泉阳泉饮品有限公司"或"仙芝楼"）
2. 截取到第一个括号为止（如"仙芝楼生物科技（福建南平）"→"仙芝楼生物科技"）
3. 只返回名称，不要描述
4. 按出现顺序排列，最多5个
5. 排除以下本品牌词：%s

返回JSON格式：{"competitors": ["竞品1", "竞品2", ...]}
如果没有竞品则返回：{"competitors": []}

AI回答：
%s

直接返回JSON，不要输出思考过程。`, ownTerms, answerText)

	// max_tokens 设为 8192：思考型模型会先消耗 token 做 reasoning，
	// 再输出正式 content。4096 会被思考过程耗尽导致 JSON 被截断。
	payload := map[string]any{
		"model": modelID,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userPrompt},
		},
		"max_tokens":  8192,
		"temperature": 0,
	}
	body, _ := json.Marshal(payload)

	trimmedBase := strings.TrimRight(baseURL, "/")
	var url string
	if strings.HasSuffix(trimmedBase, "/v1") {
		url = trimmedBase + "/chat/completions"
	} else {
		url = trimmedBase + "/v1/chat/completions"
	}
	slog.Info("callLLMForCompetitorExtraction: 调用", "url", url, "model", modelID, "timeout_sec", timeoutSec)
	timeout := time.Duration(timeoutSec) * time.Second
	if timeout == 0 || timeout > 120*time.Second {
		timeout = 120 * time.Second
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		slog.Warn("callLLMForCompetitorExtraction: 创建请求失败", "err", err)
		return nil
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		slog.Warn("callLLMForCompetitorExtraction: HTTP 调用失败", "err", err)
		return nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		errBody, _ := io.ReadAll(resp.Body)
		slog.Warn("callLLMForCompetitorExtraction: 非 200 响应", "status", resp.StatusCode, "body", string(errBody))
		return nil
	}

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		slog.Warn("callLLMForCompetitorExtraction: 读取响应失败", "err", err)
		return nil
	}
	slog.Info("callLLMForCompetitorExtraction: 响应", "body_len", len(respBody))

	// 解析 OpenAI compatible chat completion 响应
	var result struct {
		Choices []struct {
			Message struct {
				Content   string `json:"content"`
				Reasoning string `json:"reasoning_content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil
	}
	if len(result.Choices) == 0 {
		return nil
	}

	// 兼容思考型模型：优先取 Content，为空时取 ReasoningContent
	content := strings.TrimSpace(result.Choices[0].Message.Content)
	reasoning := strings.TrimSpace(result.Choices[0].Message.Reasoning)
	if content == "" && reasoning != "" {
		content = reasoning
	}
	if content == "" {
		return nil
	}

	// 从 content 中提取 JSON。思考型模型可能把思维链放 content，
	// 正式 JSON 在末尾或被包裹在 ```json ``` 中；也可能 JSON 在 reasoning_content。
	var competitorResp struct {
		Competitors []string `json:"competitors"`
	}
	// 候选文本：先 content，再 reasoning（content 是思考过程时 reasoning 可能有 JSON）
	candidates := make([]string, 0, 2)
	if content != "" {
		candidates = append(candidates, content)
	}
	if reasoning != "" && reasoning != content {
		candidates = append(candidates, reasoning)
	}
	extracted := false
	for _, text := range candidates {
		// 1. 去除 markdown code block 包裹
		stripped := stripCodeFence(text)
		// 2. 尝试直接解析
		if err := json.Unmarshal([]byte(stripped), &competitorResp); err == nil {
			extracted = true
			break
		}
		// 3. 用正则提取 {"competitors": [...]} 片段（非贪婪，跨行）
		if m := competitorJSONRe.FindString(stripped); m != "" {
			if err := json.Unmarshal([]byte(m), &competitorResp); err == nil {
				extracted = true
				break
			}
		}
	}
	if !extracted {
		slog.Warn("callLLMForCompetitorExtraction: 无法提取 JSON", "content", content)
		return nil
	}

	// 清洗：去空、去重
	competitors := dedupeNonEmpty(competitorResp.Competitors)
	if len(competitors) > 5 {
		competitors = competitors[:5]
	}
	return competitors
}

// dedupeNonEmpty 去除空字符串并去重，保持顺序。
func dedupeNonEmpty(items []string) []string {
	seen := make(map[string]bool)
	out := make([]string, 0, len(items))
	for _, s := range items {
		s = strings.TrimSpace(s)
		if s == "" || seen[s] {
			continue
		}
		seen[s] = true
		out = append(out, s)
	}
	return out
}

// competitorJSONRe 匹配 {"competitors": [...]} JSON 片段（跨行、非贪婪）。
// 用于从思考型模型的混合输出中提取正式 JSON 结果。
var competitorJSONRe = regexp.MustCompile(`\{[^{}]*"competitors"\s*:\s*\[[^\]]*\][^{}]*\}`)

// stripCodeFence 去除 markdown 代码块包裹（```json ... ``` 或 ``` ... ```）。
// 如果文本不含代码块围栏，则原样返回。
func stripCodeFence(text string) string {
	// 去除开头的 ```json 或 ``` 行
	fenceStart := regexp.MustCompile("(?s)^\\s*```(?:json)?\\s*\\n")
	if m := fenceStart.FindString(text); m != "" {
		text = strings.TrimPrefix(text, m)
		// 去除结尾的 ```
		text = strings.TrimSuffix(strings.TrimRight(text, " \t\r\n"), "```")
	}
	return strings.TrimSpace(text)
}

// headerBoundaryRe 匹配 markdown 标题标记（#/##/###…及后续空白）。
// 部分平台回答中标题标记未换行内联出现（如 "百岁山矿泉水### 1、百岁山"），
// 序号实际跟随标题而非行首；将标题标记替换为换行后再解析行首序号。
var headerBoundaryRe = regexp.MustCompile(`#{1,6}[ \t]*`)

// brandRankInText 扫描品牌词在回答中的全部出现位置（按出现顺序），
// 返回第一个所在行行首带列表序号的出现解析出的排名。
// 品牌首次出现常在标题/概述（无序号），推荐列表中的后续出现才带序号，
// 因此不能只看首个提及位置；全部出现均无序号时返回 0（无法判定排名，
// 不计入 TOP3）。
func brandRankInText(answerText string, brandTerms []string) int {
	if answerText == "" || len(brandTerms) == 0 {
		return 0
	}
	// 将 markdown 标题标记视为行边界（见 headerBoundaryRe 注释）
	normalized := headerBoundaryRe.ReplaceAllString(answerText, "\n")
	answerLower := strings.ToLower(normalized)
	// 收集所有品牌词的全部出现位置（字节偏移），排序后按出现顺序判定
	var positions []int
	for _, term := range brandTerms {
		if term == "" {
			continue
		}
		termLower := strings.ToLower(term)
		start := 0
		for {
			idx := strings.Index(answerLower[start:], termLower)
			if idx < 0 {
				break
			}
			positions = append(positions, start+idx)
			start += idx + len(termLower)
		}
	}
	sort.Ints(positions)
	for _, pos := range positions {
		if rank := brandRankOfLine(normalized, pos); rank > 0 {
			return rank
		}
	}
	return 0
}

// brandRankOfLine 从回答文本中解析品牌在推荐列表中的排名。
// 取品牌出现位置所在行，解析行首的列表序号（阿拉伯数字 "1." "2、" 或
// 中文数字 "一、" "二、"）；行首无序号返回 0（表示无法判定排名，不计入 TOP3）。
func brandRankOfLine(answerText string, brandIdx int) int {
	if brandIdx < 0 || brandIdx >= len(answerText) {
		return 0
	}
	lineStart := 0
	if i := strings.LastIndexByte(answerText[:brandIdx], '\n'); i >= 0 {
		lineStart = i + 1
	}
	// 行首到品牌之间的前缀，剥掉空白与 markdown 装饰符
	prefix := strings.TrimSpace(answerText[lineStart:brandIdx])
	prefix = strings.TrimLeft(prefix, "*#>-•·• ")
	if prefix == "" {
		return 0
	}
	// 前缀过长时，序号更可能属于场景/栏目分组而非品牌排名
	// （如 "3. 办公室/家庭大包装（长期饮用）景田（百岁山）"），不判定排名
	if len([]rune(prefix)) > 10 {
		return 0
	}
	return parseRankPrefix(prefix)
}

// chineseRankDigits 中文数字序号用字（一~九）。
var chineseRankDigits = map[rune]int{
	'一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
	'六': 6, '七': 7, '八': 8, '九': 9,
}

// isRankSeparator 判断序号后的分隔符（如 "1." "2、" "3)" "一："）。
func isRankSeparator(r rune) bool {
	switch r {
	case '.', '、', ')', '）', ':', '：', ' ', '\t', '*', '·':
		return true
	}
	return false
}

// parseRankPrefix 解析前缀开头的列表序号，支持阿拉伯数字（"1." "2、"）
// 与中文数字（"一、" "二十三、"，范围 1~50）；无有效序号返回 0。
func parseRankPrefix(prefix string) int {
	runes := []rune(prefix)
	if len(runes) == 0 {
		return 0
	}
	// 阿拉伯数字序号：数字串 + 分隔符
	i, n := 0, 0
	for i < len(runes) && runes[i] >= '0' && runes[i] <= '9' {
		n = n*10 + int(runes[i]-'0')
		i++
	}
	if i > 0 {
		if n <= 0 || n > 50 || i >= len(runes) || !isRankSeparator(runes[i]) {
			return 0
		}
		return n
	}
	// 中文数字序号：一~十九、二十~二十九
	val, width := parseChineseRank(runes)
	if width == 0 || val <= 0 || val > 50 {
		return 0
	}
	if width < len(runes) && isRankSeparator(runes[width]) {
		return val
	}
	return 0
}

// parseChineseRank 解析中文数字序号（一~九、十~十九、二十~二十九），
// 返回数值与消耗的字符数；非中文数字开头返回 (0, 0)。
func parseChineseRank(runes []rune) (int, int) {
	if len(runes) == 0 {
		return 0, 0
	}
	d, ok := chineseRankDigits[runes[0]]
	if !ok {
		if runes[0] == '十' { // 十、十一…
			val, w := 10, 1
			if len(runes) > 1 {
				if d2, ok2 := chineseRankDigits[runes[1]]; ok2 {
					val += d2
					w = 2
				}
			}
			return val, w
		}
		return 0, 0
	}
	val, w := d, 1
	if len(runes) > 1 && runes[1] == '十' { // 二十三…
		val *= 10
		w = 2
		if len(runes) > 2 {
			if d2, ok2 := chineseRankDigits[runes[2]]; ok2 {
				val += d2
				w = 3
			}
		}
	}
	return val, w
}

// normalizeContactForMatch 归一化联系方式以便做模糊匹配。
// 剥除空格、横线、括号等分隔符，应对格式差异（如 010-12345678 vs 01012345678 vs (010)12345678）。
func normalizeContactForMatch(s string) string {
	if s == "" {
		return ""
	}
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		switch r {
		case ' ', '\t', '-', '(', ')', '（', '）', '+':
			continue
		default:
			b.WriteRune(r)
		}
	}
	return b.String()
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

type geoTaskResult struct {
	QuestionText   string              `json:"questionText"`
	AnswerText     string              `json:"answerText"`
	AnswerStatus   string              `json:"answerStatus"`
	ScreenshotKey  string              `json:"screenshotKey"`
	SessionRef     string              `json:"sessionRef"`
	ObservedAt     time.Time           `json:"observedAt"`
	Citations      []geoCitationResult `json:"citations"`
	Mentions       []geoMentionResult  `json:"mentions"`
	AnalysisResult *geoAnalysisResult  `json:"analysisResult"`
}

type geoCitationResult struct {
	URL                string `json:"url"`
	Domain             string `json:"domain"`
	Title              string `json:"title"`
	IsEnterpriseSource bool   `json:"isEnterpriseSource"`
	ArticleID          uint64 `json:"articleId"`
	MetadataJSON       string `json:"metadataJson"`
}

type geoMentionResult struct {
	EntityType string  `json:"entityType"`
	EntityID   uint64  `json:"entityId"`
	Text       string  `json:"text"`
	Sentiment  string  `json:"sentiment"`
	Confidence float64 `json:"confidence"`
}

type geoAnalysisResult struct {
	AnalysisVersion uint32  `json:"analysisVersion"`
	RuleVersion     string  `json:"ruleVersion"`
	Status          string  `json:"status"`
	BrandMentioned  bool    `json:"brandMentioned"`
	EnterpriseCited bool    `json:"enterpriseCited"`
	VisibilityScore float64 `json:"visibilityScore"`
	AccuracyScore   float64 `json:"accuracyScore"`
	Confidence      float64 `json:"confidence"`
	ResultJSON      string  `json:"resultJson"`
}

func hashContent(text string) string {
	digest := sha256.Sum256([]byte(text))
	return hex.EncodeToString(digest[:])
}

// truncateSessionRef 截断 session_ref 到 2048 字符，防止极端长 URL 触发 DB 写入失败。
// geo_answer_snapshots.session_ref 列为 varchar(2048)。
func truncateSessionRef(ref string) string {
	const maxLen = 2048
	if len(ref) <= maxLen {
		return ref
	}
	return ref[:maxLen]
}

// truncateCitationURL 截断引用 URL 到 2048 字符，防止极端长 URL 触发 DB 写入失败。
// geo_citations.url 列当前为 varchar(2048)；迁移 000049 将扩到 varchar(8192)。
//
// 特殊处理：Kimi 等平台的引用 URL 会带 "#:~:text=<大量URL编码中文>" 的
// Scroll-to-Text Fragment（浏览器自动生成的高亮参数），可能拉到 KB 级长度。
// 这部分对引用来源识别没有任何价值，先剥离再截断，URL 既短又保留核心信息。
func truncateCitationURL(rawURL string) string {
	const maxLen = 2048
	if len(rawURL) <= maxLen {
		return rawURL
	}
	// 优先剥离 fragment（# 后面的内容，含 :~:text= 高亮参数）。
	if idx := strings.Index(rawURL, "#"); idx >= 0 {
		stripped := rawURL[:idx]
		if len(stripped) <= maxLen {
			return stripped
		}
		return stripped[:maxLen]
	}
	// 无 fragment 但仍超长（罕见），直接截断。
	return rawURL[:maxLen]
}

// matchCitationsToArticles 把刚保存的引用 URL 与企业已发布文章做匹配，
// 把匹配到的 article_id 写回 geo_citations。这样信源分析的
// 「文章引用量」和「Top10 文章引用」就能正确统计了。
//
// 匹配策略（严格，避免误匹配）：
//  1. 精确匹配：citation.URL 与 pub_tasks.result_url 完全一致
//  2. 去参匹配：剥离 ?query 和 #fragment 后再比
//
// 注意：不使用"包含匹配"，因为平台管理URL（如 weibo.com/、om.qq.com 等）
// 会误匹配大量无关引用。
func matchCitationsToArticles(tx *gorm.DB, enterpriseID, snapshotID uint64) error {
	// 1. 加载企业已发布的文章 URL（过滤掉平台管理页面URL）
	type pubTaskURL struct {
		ArticleID uint64 `gorm:"column:article_id"`
		ResultURL string `gorm:"column:result_url"`
	}
	var tasks []pubTaskURL
	if err := tx.Table(model.TablePublishTasks).
		Select("article_id, result_url").
		Where("enterprise_id = ? AND status = 'succeeded' AND deleted_at IS NULL AND result_url != '' AND result_url IS NOT NULL", enterpriseID).
		Find(&tasks).Error; err != nil {
		return err
	}

	// 过滤掉平台管理页面 URL，只保留真正的文章 URL
	var validTasks []pubTaskURL
	for _, t := range tasks {
		if isPlatformManagementURL(t.ResultURL) {
			continue
		}
		validTasks = append(validTasks, t)
	}
	if len(validTasks) == 0 {
		return nil
	}

	// 2. 构建 URL 索引：原 URL → article_id、去参 URL → article_id
	exactMap := make(map[string]uint64, len(validTasks))
	normMap := make(map[string]uint64, len(validTasks))
	for _, t := range validTasks {
		if t.ResultURL == "" {
			continue
		}
		exactMap[t.ResultURL] = t.ArticleID
		normMap[normalizeURL(t.ResultURL)] = t.ArticleID
	}

	// 3. 加载当前快照的引用（article_id 为 NULL 的才需要匹配）
	type citeRow struct {
		ID  uint64 `gorm:"column:id"`
		URL string `gorm:"column:url"`
	}
	var cites []citeRow
	if err := tx.Table(model.TableCitations).
		Select("id, url").
		Where("answer_snapshot_id = ? AND article_id IS NULL", snapshotID).
		Find(&cites).Error; err != nil {
		return err
	}
	if len(cites) == 0 {
		return nil
	}

	// 4. 逐条匹配并更新（仅精确 + 去参，不使用包含匹配）
	// 去重：同一快照同一文章最多写1次 article_id（对齐盘古设计：
	// 一次问答同一文章无论出现多少次，只计1次引用）
	updated := 0
	matchedArticles := make(map[uint64]bool) // 已匹配的 article_id
	for _, c := range cites {
		var matchedArticleID uint64
		// 精确匹配
		if aid, ok := exactMap[c.URL]; ok {
			matchedArticleID = aid
		}
		// 去参匹配
		if matchedArticleID == 0 {
			if aid, ok := normMap[normalizeURL(c.URL)]; ok {
				matchedArticleID = aid
			}
		}
		if matchedArticleID != 0 {
			// 同一快照同一文章只处理一次
			if matchedArticles[matchedArticleID] {
				continue
			}
			matchedArticles[matchedArticleID] = true
			if err := tx.Table(model.TableCitations).
				Where("id = ?", c.ID).
				Update("article_id", matchedArticleID).Error; err != nil {
				slog.Warn("update citation article_id failed", "citation_id", c.ID, "article_id", matchedArticleID, "error", err)
				continue
			}
			updated++
		}
	}

	slog.Info("matched citations to articles", "snapshot_id", snapshotID, "total_citations", len(cites), "matched", updated)
	return nil
}

// isPlatformManagementURL 判断 URL 是否为平台管理页面（非文章URL）。
// 这些 URL 是发布平台的管理后台地址，不是真正发布的文章链接。
func isPlatformManagementURL(url string) bool {
	platformMgrPatterns := []string{
		"om.qq.com/main/creation/article",
		"om.qq.com/main/management/articleManage",
		"mp.sohu.com/mpfe/v4/contentManagement",
		"mp.163.com/subscribe_v4/index.html",
		"passport.csdn.net/login",
		"baijiahao.baidu.com/builder/",
		"mp.toutiao.com/profile_v4",
		// 微博只过滤首页和管理页，不过滤文章页（weibo.com/{uid}/{articleId}）
		"weibo.com/",
	}
	for _, p := range platformMgrPatterns {
		// 微博特殊处理：只匹配 https://weibo.com/ 精确首页
		if p == "weibo.com/" {
			if url == "https://weibo.com/" || url == "http://weibo.com/" || url == "https://weibo.com" || url == "http://weibo.com" {
				return true
			}
			continue
		}
		if strings.Contains(url, p) {
			return true
		}
	}
	return false
}

// normalizeURL 对 URL 做归一化预处理，方便做不含参数的匹配。
// 处理步骤（对齐盘古设计）：
//  1. 去掉 fragment (#xxx)
//  2. http→https 标准化
//  3. 去掉 www. 前缀
//  4. 域名转小写（path 保留原始大小写）
//  5. 保留文章标识参数（id、article_id、doc_id、item_id 等）
//  6. 去掉追踪参数（utm_xxx、from、wfr 等）
//  7. 去尾斜杠
//
// https://www.example.com/path?x=1#top → https://example.com/path
// https://baijiahao.baidu.com/s?id=123&wfr=spider → https://baijiahao.baidu.com/s?id=123
func normalizeURL(raw string) string {
	if raw == "" {
		return ""
	}
	// 先剥 fragment
	if idx := strings.Index(raw, "#"); idx >= 0 {
		raw = raw[:idx]
	}
	// http→https
	if strings.HasPrefix(raw, "http://") {
		raw = "https://" + raw[len("http://"):]
	}
	// 去 www.
	if strings.HasPrefix(raw, "https://www.") {
		raw = "https://" + raw[len("https://www."):]
	}
	// 只对域名部分转小写，path 保留原始大小写
	if idx := strings.Index(raw, "https://"); idx == 0 {
		rest := raw[len("https://"):]
		// 找到第一个 / 分隔域名和 path
		slashIdx := strings.Index(rest, "/")
		if slashIdx >= 0 {
			domain := strings.ToLower(rest[:slashIdx])
			path := rest[slashIdx:]
			raw = "https://" + domain + path
		} else {
			// 只有域名没有 path
			raw = "https://" + strings.ToLower(rest)
		}
	}
	// 解析 query，保留文章标识参数，去掉追踪参数
	if idx := strings.Index(raw, "?"); idx >= 0 {
		base := raw[:idx]
		query := raw[idx+1:]
		// 查找文章标识参数（id、article_id、doc_id、item_id 等）
		articleIDParams := []string{"id=", "article_id=", "doc_id=", "item_id=", "post_id="}
		for _, pair := range strings.Split(query, "&") {
			for _, prefix := range articleIDParams {
				if strings.HasPrefix(pair, prefix) {
					return strings.TrimRight(base+"?"+pair, "/")
				}
			}
		}
		return strings.TrimRight(base, "/")
	}
	return strings.TrimRight(raw, "/")
}

func (r *workerTaskRepo) ListWorkers(ctx context.Context, status string) ([]*biz.WorkerNode, error) {
	db := r.data.DB(ctx)
	if status != "" {
		db = db.Where("status = ?", status)
	}
	var workers []model.WorkerNode
	if err := db.Order("id DESC").Find(&workers).Error; err != nil {
		return nil, err
	}
	result := make([]*biz.WorkerNode, 0, len(workers))
	for i := range workers {
		result = append(result, workerDO(&workers[i]))
	}
	return result, nil
}

func (r *workerTaskRepo) ChangeWorkerStatus(ctx context.Context, id, version uint64, action string) (*biz.WorkerNode, error) {
	updates := map[string]any{"version": gorm.Expr("version + 1")}
	switch action {
	case "approve", "resume":
		updates["approval_status"] = "approved"
		updates["status"] = "active"
	case "pause":
		updates["status"] = "suspended"
	case "revoke":
		now := time.Now().UTC()
		updates["status"] = "revoked"
		updates["approval_status"] = "revoked"
		updates["revoked_at"] = now
	}
	result := r.data.DB(ctx).Model(&model.WorkerNode{}).Where("id = ? AND version = ?", id, version).Updates(updates)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected != 1 {
		return nil, biz.ErrLeaseConflict
	}
	var worker model.WorkerNode
	if err := r.data.DB(ctx).First(&worker, id).Error; err != nil {
		return nil, mapWorkerExecutionError(err)
	}
	return workerDO(&worker), nil
}

func expireWorkerLeases(tx *gorm.DB, now time.Time) error {
	var leases []model.TaskLease
	if err := tx.Where("status = ? AND expires_at <= ?", "active", now).Find(&leases).Error; err != nil {
		return err
	}
	for i := range leases {
		lease := &leases[i]
		if err := tx.Model(lease).Updates(map[string]any{"status": "expired", "released_at": now, "release_reason": "lease_expired"}).Error; err != nil {
			return err
		}
		switch lease.TaskType {
		case "geo":
			if err := tx.Model(&model.GEOTask{}).Where("id = ? AND current_lease_id = ? AND status = ?", lease.TaskID, lease.ID, "leased").Updates(map[string]any{"status": "queued", "current_lease_id": nil, "error_category": "worker", "error_code": "LEASE_EXPIRED", "error_message": "worker lease expired", "version": gorm.Expr("version + 1")}).Error; err != nil {
				return err
			}
		default:
			if err := tx.Model(&model.PublishTask{}).Where("id = ? AND current_lease_id = ? AND status = ?", lease.TaskID, lease.ID, "leased").Updates(map[string]any{"status": "queued", "current_lease_id": nil, "version": gorm.Expr("version + 1")}).Error; err != nil {
				return err
			}
			if err := tx.Model(&model.PublishAttempt{}).Where("lease_id = ? AND status = ?", lease.ID, "running").Updates(map[string]any{"status": "expired", "finished_at": now, "error_category": "worker", "error_code": "LEASE_EXPIRED", "error_message": "worker lease expired"}).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func claimPublishTask(tx *gorm.DB, worker *biz.WorkerNode, filter biz.TaskClaimFilter, now time.Time, snapshotErr *error) (*biz.TaskLease, error) {
	query := tx.Clauses(clause.Locking{Strength: "UPDATE", Options: "SKIP LOCKED"}).
		Where("status IN ? AND scheduled_at <= ? AND execution_mode = ?", []string{"queued", "retry_wait"}, now, "automatic")
	if filter.TaskID != 0 {
		query = query.Where("id = ?", filter.TaskID)
	}
	if len(filter.PublishChannelIDs) > 0 {
		query = query.Where("publish_channel_id IN ?", filter.PublishChannelIDs)
	}
	var task model.PublishTask
	if err := query.Order("priority DESC, scheduled_at ASC, id ASC").First(&task).Error; err != nil {
		if stderrors.Is(err, gorm.ErrRecordNotFound) {
			return nil, biz.ErrLeaseNotFound
		}
		return nil, err
	}
	leaseToken, err := secureWorkerToken()
	if err != nil {
		return nil, err
	}
	lease := model.TaskLease{
		TaskType: "publish", TaskID: task.ID, WorkerNodeID: worker.ID,
		LeaseTokenHash: hashWorkerToken(leaseToken), Status: "active", LeaseVersion: 1,
		LeasedAt: now, ExpiresAt: now.Add(workerLeaseDuration),
	}
	if err := tx.Create(&lease).Error; err != nil {
		return nil, err
	}
	attempt := model.PublishAttempt{
		ImmutableTenantModel: model.ImmutableTenantModel{EnterpriseID: task.EnterpriseID, CreatedAt: now},
		PublishTaskID:        task.ID, AttemptNumber: task.AttemptCount + 1, WorkerNodeID: worker.ID,
		LeaseID: lease.ID, IdempotencyKey: fmt.Sprintf("lease:%d", lease.ID), Status: "running", StartedAt: now,
		ClientVersion: worker.ClientVersion,
	}
	if err := tx.Create(&attempt).Error; err != nil {
		return nil, err
	}
	result := tx.Model(&model.PublishTask{}).Where("id = ? AND version = ?", task.ID, task.Version).Updates(map[string]any{
		"status": "leased", "current_lease_id": lease.ID, "attempt_count": gorm.Expr("attempt_count + 1"),
		"version": gorm.Expr("version + 1"),
	})
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected != 1 {
		return nil, biz.ErrLeaseConflict
	}
	snapshotJSON, credentialPayload, err := buildPublishTaskSnapshot(tx, &task)
	if err != nil {
		// 快照构建失败（如缺失凭据/授权）：将任务标记为 failed 并提交事务，
		// 避免任务回滚到 queued 后被 worker 反复领取形成死循环。
		failClaimedPublishTask(tx, &task, &lease, err, now)
		*snapshotErr = err
		return nil, nil // 返回 nil 让事务提交（失败状态已写入）
	}
	return &biz.TaskLease{
		ID: lease.ID, TaskID: task.ID, LeaseVersion: lease.LeaseVersion, TaskType: lease.TaskType,
		LeaseToken: leaseToken, TaskSnapshotJSON: snapshotJSON, CredentialPayload: credentialPayload,
		ExpiresAt: lease.ExpiresAt,
	}, nil
}

// failClaimedPublishTask 将已领取但快照构建失败的任务标记为 failed。
// 调用时已在事务内，错误会被忽略（尽力写入失败状态）。
func failClaimedPublishTask(tx *gorm.DB, task *model.PublishTask, lease *model.TaskLease, snapshotErr error, now time.Time) {
	errMsg := snapshotErr.Error()
	var kratosErr *errors.Error
	if stderrors.As(snapshotErr, &kratosErr) {
		errMsg = fmt.Sprintf("%s: %s", kratosErr.Reason, kratosErr.Message)
	}
	_ = tx.Model(&model.PublishAttempt{}).Where("lease_id = ?", lease.ID).Updates(map[string]any{
		"status": "failed", "finished_at": now,
		"error_category": "worker", "error_code": "SNAPSHOT_BUILD_FAILED",
		"error_message": errMsg,
	}).Error
	_ = tx.Model(&model.PublishTask{}).Where("id = ?", task.ID).Updates(map[string]any{
		"status": "failed", "current_lease_id": nil,
		"error_category": "worker", "error_code": "SNAPSHOT_BUILD_FAILED",
		"error_message": errMsg, "completed_at": now,
		"version": gorm.Expr("version + 1"),
	}).Error
	_ = tx.Model(lease).Updates(map[string]any{
		"status": "released", "released_at": now, "release_reason": "snapshot_build_failed",
	}).Error
	// 计费闭环：快照构建失败，归还预留配额（尽力归还，错误忽略）。
	_ = releaseQuota(tx, task.EnterpriseID, "publish_tasks", 1, "publish_task", task.ID, fmt.Sprintf("publish-task-release:%d", task.ID))
}

// failClaimedGeoTask 将已领取但快照构建失败的 GEO 任务标记为 failed。
func failClaimedGeoTask(tx *gorm.DB, task *model.GEOTask, lease *model.TaskLease, snapshotErr error, now time.Time) {
	_ = tx.Model(&model.GEOTask{}).Where("id = ?", task.ID).Updates(map[string]any{
		"status": "failed", "current_lease_id": nil,
		"error_category": "worker", "error_code": "SNAPSHOT_BUILD_FAILED",
		"error_message": snapshotErr.Error(), "completed_at": now,
		"version": gorm.Expr("version + 1"),
	}).Error
	_ = tx.Model(lease).Updates(map[string]any{
		"status": "released", "released_at": now, "release_reason": "snapshot_build_failed",
	}).Error
	// 计费闭环：快照构建失败，归还预留配额（尽力归还，错误忽略）。
	_ = releaseQuota(tx, task.EnterpriseID, "geo_queries", 1, "geo_task", task.ID, fmt.Sprintf("geo-task-release:%d", task.ID))
}

func claimGeoTask(tx *gorm.DB, worker *biz.WorkerNode, filter biz.TaskClaimFilter, now time.Time, snapshotErr *error) (*biz.TaskLease, error) {
	query := tx.Clauses(clause.Locking{Strength: "UPDATE", Options: "SKIP LOCKED"}).
		Where("status IN ? AND scheduled_at <= ?", []string{"queued", "retry_wait"}, now)
	if filter.TaskID != 0 {
		query = query.Where("id = ?", filter.TaskID)
	}
	if len(filter.InclusionSiteIDs) > 0 {
		query = query.Where("inclusion_site_id IN ?", filter.InclusionSiteIDs)
	}
	var task model.GEOTask
	if err := query.Order("priority DESC, scheduled_at ASC, id ASC").First(&task).Error; err != nil {
		if stderrors.Is(err, gorm.ErrRecordNotFound) {
			return nil, biz.ErrLeaseNotFound
		}
		return nil, err
	}
	leaseToken, err := secureWorkerToken()
	if err != nil {
		return nil, err
	}
	lease := model.TaskLease{
		TaskType: "geo", TaskID: task.ID, WorkerNodeID: worker.ID,
		LeaseTokenHash: hashWorkerToken(leaseToken), Status: "active", LeaseVersion: 1,
		LeasedAt: now, ExpiresAt: now.Add(workerLeaseDuration),
	}
	if err := tx.Create(&lease).Error; err != nil {
		return nil, err
	}
	result := tx.Model(&model.GEOTask{}).Where("id = ? AND version = ?", task.ID, task.Version).Updates(map[string]any{
		"status": "leased", "current_lease_id": lease.ID, "attempt_count": gorm.Expr("attempt_count + 1"),
		"version": gorm.Expr("version + 1"),
	})
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected != 1 {
		return nil, biz.ErrLeaseConflict
	}
	snapshotJSON, credentialPayload, err := buildGeoTaskSnapshot(tx, &task)
	if err != nil {
		// 快照构建失败：将任务标记为 failed 并提交事务，避免反复领取
		failClaimedGeoTask(tx, &task, &lease, err, now)
		*snapshotErr = err
		return nil, nil
	}
	return &biz.TaskLease{
		ID: lease.ID, TaskID: task.ID, LeaseVersion: lease.LeaseVersion, TaskType: lease.TaskType,
		LeaseToken: leaseToken, TaskSnapshotJSON: snapshotJSON, CredentialPayload: credentialPayload,
		ExpiresAt: lease.ExpiresAt,
	}, nil
}

func buildPublishTaskSnapshot(tx *gorm.DB, task *model.PublishTask) (string, []byte, error) {
	var snapshot model.ArticleSnapshot
	if err := tx.Where("enterprise_id = ? AND id = ?", task.EnterpriseID, task.ArticleSnapshotID).First(&snapshot).Error; err != nil {
		if stderrors.Is(err, gorm.ErrRecordNotFound) {
			return "", nil, errors.NotFound("SNAPSHOT_NOT_FOUND", fmt.Sprintf("article snapshot #%d not found for task #%d", task.ArticleSnapshotID, task.ID))
		}
		return "", nil, err
	}
	var article model.Article
	if err := tx.Select("id", "summary").Where("enterprise_id = ? AND id = ?", task.EnterpriseID, snapshot.ArticleID).First(&article).Error; err != nil {
		if stderrors.Is(err, gorm.ErrRecordNotFound) {
			return "", nil, errors.NotFound("ARTICLE_NOT_FOUND", fmt.Sprintf("article #%d not found for task #%d", snapshot.ArticleID, task.ID))
		}
		return "", nil, err
	}
	var channel model.PublishChannel
	if err := tx.First(&channel, task.PublishChannelID).Error; err != nil {
		if stderrors.Is(err, gorm.ErrRecordNotFound) {
			return "", nil, errors.NotFound("CHANNEL_NOT_FOUND", fmt.Sprintf("publish channel #%d not found for task #%d", task.PublishChannelID, task.ID))
		}
		return "", nil, err
	}
	var target model.PublishTarget
	if task.PublishTargetID != nil {
		if err := tx.First(&target, *task.PublishTargetID).Error; err != nil {
			if stderrors.Is(err, gorm.ErrRecordNotFound) {
				return "", nil, errors.NotFound("TARGET_NOT_FOUND", fmt.Sprintf("publish target #%d not found for task #%d", *task.PublishTargetID, task.ID))
			}
			return "", nil, err
		}
	}
	var account model.SelfMediaAuthorization
	var credential model.CredentialEnvelope
	// 发文执行时按 (enterprise, channel) 取当前最新有效授权，不依赖 task 创建时绑定的 platform_account_id。
	// 这样用户删除旧授权并重新授权后，已有 task 仍能拿到新凭据正常发文。
	if err := tx.Where("enterprise_id = ? AND publish_channel_id = ? AND authorization_status = ? AND usage_status = ?", task.EnterpriseID, task.PublishChannelID, 3, 1).Order("id DESC").First(&account).Error; err != nil {
		if stderrors.Is(err, gorm.ErrRecordNotFound) {
			return "", nil, errors.NotFound("AUTHORIZATION_NOT_FOUND", fmt.Sprintf("no active authorization on channel #%d for task #%d (ensure authorization_status=active and usage_status=enabled)", task.PublishChannelID, task.ID))
		}
		return "", nil, err
	}
	if err := tx.Where("enterprise_id = ? AND platform_account_id = ? AND status = ? AND destroyed_at IS NULL", task.EnterpriseID, account.ID, "active").Order("id DESC").First(&credential).Error; err != nil {
		if stderrors.Is(err, gorm.ErrRecordNotFound) {
			return "", nil, errors.NotFound("CREDENTIAL_NOT_FOUND", fmt.Sprintf("active credential for platform account #%d not found for task #%d (credential may be missing or destroyed)", account.ID, task.ID))
		}
		return "", nil, err
	}
	payload := map[string]any{
		"taskId": task.ID, "enterpriseId": task.EnterpriseID, "articleId": snapshot.ArticleID,
		"article": map[string]any{
			"title": snapshot.Title, "summary": article.Summary,
			"contentMarkdown": snapshot.ContentMarkdown, "contentHtml": snapshot.ContentHTML,
			"coverImageUrl": snapshotCoverURL(snapshot.GalleryRefsJSON),
		},
		"platform": map[string]any{
			"code": channel.Code, "name": channel.Name, "driverType": channel.DriverType,
			"loginUrl": channel.LoginURL,
		},
		"account": map[string]any{"id": account.ID, "name": account.AccountName, "externalId": account.ExternalID},
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return "", nil, err
	}
	return string(encoded), []byte(credential.CredentialPayload), nil
}

func buildGeoTaskSnapshot(tx *gorm.DB, task *model.GEOTask) (string, []byte, error) {
	var question model.Question
	if err := tx.Where("enterprise_id = ? AND id = ?", task.EnterpriseID, task.QuestionID).First(&question).Error; err != nil {
		return "", nil, err
	}
	var site model.InclusionSite
	if err := tx.First(&site, task.InclusionSiteID).Error; err != nil {
		return "", nil, err
	}
	var brand model.Brand
	if err := tx.Where("enterprise_id = ? AND id = ?", task.EnterpriseID, task.BrandID).First(&brand).Error; err != nil {
		return "", nil, err
	}
	payload := map[string]any{
		"taskId":          task.ID,
		"enterpriseId":    task.EnterpriseID,
		"monitorPlanId":   task.MonitorPlanID,
		"brandId":         task.BrandID,
		"questionId":      task.QuestionID,
		"inclusionSiteId": task.InclusionSiteID,
		"question": map[string]any{
			"text": question.Text,
		},
		"site": map[string]any{
			"code":       site.Code,
			"name":       site.Name,
			"driverType": site.DriverType,
			"entryUrl":   site.EntryURL,
		},
		"brand": map[string]any{
			"name":           brand.Name,
			"officialDomain": brand.OfficialDomain,
			"aliases":        jsonArrayStrings(brand.AliasesJSON),
		},
		"modelEntry": task.ModelEntry,
		"locale":     task.Locale,
		"region":     task.Region,
	}
	if task.PlatformAccountID != nil {
		var account model.InclusionSiteAuthorization
		if err := tx.Where("enterprise_id = ? AND id = ? AND inclusion_site_id = ? AND authorization_status = ? AND usage_status = ?", task.EnterpriseID, *task.PlatformAccountID, task.InclusionSiteID, 3, 1).First(&account).Error; err != nil {
			return "", nil, err
		}
		payload["account"] = map[string]any{"id": account.ID, "name": account.AccountName, "externalId": account.ExternalID}
		var credential model.CredentialEnvelope
		if err := tx.Where("enterprise_id = ? AND platform_account_id = ? AND status = ? AND destroyed_at IS NULL", task.EnterpriseID, account.ID, "active").Order("id DESC").First(&credential).Error; err != nil {
			return "", nil, err
		}
		encoded, err := json.Marshal(payload)
		if err != nil {
			return "", nil, err
		}
		return string(encoded), []byte(credential.CredentialPayload), nil
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return "", nil, err
	}
	return string(encoded), nil, nil
}

func jsonArrayStrings(raw []byte) []string {
	var out []string
	_ = json.Unmarshal(raw, &out)
	return out
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
	if err := tx.Create(&ledger).Error; err != nil {
		// 幂等键冲突表示已结算过，直接忽略
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			return nil
		}
		return err
	}
	return nil
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
	if err := tx.Create(&ledger).Error; err != nil {
		// 幂等键冲突表示已归还过，直接忽略
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			return nil
		}
		return err
	}
	return nil
}

func snapshotCoverURL(raw []byte) string {
	var refs []struct {
		URL       string `json:"url"`
		Placement int32  `json:"placement"`
	}
	if json.Unmarshal(raw, &refs) != nil {
		return ""
	}
	for _, ref := range refs {
		if ref.Placement == 1 && strings.TrimSpace(ref.URL) != "" {
			return strings.TrimSpace(ref.URL)
		}
	}
	if len(refs) > 0 {
		return strings.TrimSpace(refs[0].URL)
	}
	return ""
}

func publishResultIdentifiers(raw string) (string, string) {
	var result struct {
		PublishedURL      string `json:"publishedUrl"`
		PlatformArticleID string `json:"platformArticleId"`
	}
	if json.Unmarshal([]byte(raw), &result) != nil {
		return "", ""
	}
	return strings.TrimSpace(result.PublishedURL), strings.TrimSpace(result.PlatformArticleID)
}

func containsTaskType(values []string, expected string) bool {
	if len(values) == 0 {
		return true
	}
	for _, value := range values {
		if value == expected {
			return true
		}
	}
	return false
}

func secureWorkerToken() (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func hashWorkerToken(token string) string {
	digest := sha256.Sum256([]byte(strings.TrimSpace(token)))
	return hex.EncodeToString(digest[:])
}

func mapWorkerExecutionError(err error) error {
	if err == nil {
		return nil
	}
	if stderrors.Is(err, gorm.ErrRecordNotFound) {
		return biz.ErrLeaseNotFound
	}
	var mysqlError *mysql.MySQLError
	if stderrors.As(err, &mysqlError) && mysqlError.Number == 1062 {
		return biz.ErrLeaseConflict
	}
	return err
}

// analyzeSentiment 调用 LLM 判定 AI 回答对品牌/企业的情感倾向。
// 仅在收录成功（included=true）时由调用方触发。流程：
//  1. 在回答文本中定位包含品牌词的句子片段（避免其他品牌语句干扰）；
//  2. 将片段送入配置了情感分析用途的 LLM 做情感判定；
//  3. 返回 positive / negative / neutral。
//
// LLM 不可用或调用失败时返回 neutral，不影响收录分析流程。
func analyzeSentiment(tx *gorm.DB, data *Data, answerText string, brandTerms []string, enterpriseName string) string {
	const fallback = "neutral"

	// 截取包含品牌词的句子片段，避免全文送 LLM
	snippets := extractBrandSnippets(answerText, brandTerms, enterpriseName)
	if snippets == "" {
		slog.Debug("analyzeSentiment: snippets 为空，回退 neutral")
		return fallback
	}
	slog.Debug("analyzeSentiment: 启动", "snippets_len", len(snippets), "brandTerms", brandTerms, "enterprise", enterpriseName)

	// 查询配置了情感倾向分析用途的活跃模型（按 sort_order 优先）
	// 注意：用 purpose=8 (SentimentTendencyAnalysis) 查收录的情感分析，
	// 不是 purpose=7 (SentimentAnalysis)，后者是售前诊断用的。
	var wm model.WritingModel
	err := tx.Table(model.TableWritingModels+" AS m").
		Joins("JOIN "+model.TableWritingModelPurposes+" AS p ON p.writing_model_id = m.id").
		Where("p.purpose = ? AND m.status = ? AND m.deleted_at IS NULL",
			model.WritingModelPurposeSentimentTendencyAnalysis, model.WritingModelStatusActive).
		Order("m.sort_order ASC, m.id ASC").
		First(&wm).Error
	if err != nil {
		slog.Warn("analyzeSentiment: 查询情感分析模型失败", "err", err)
		return fallback
	}
	slog.Info("analyzeSentiment: 使用模型", "id", wm.ID, "display_name", wm.DisplayName, "model_id", wm.ModelID, "sort_order", wm.SortOrder)

	// 查询凭据
	var cred model.WritingModelCredential
	if err := tx.Where("writing_model_id = ?", wm.ID).First(&cred).Error; err != nil {
		slog.Warn("analyzeSentiment: 查询凭据失败", "err", err)
		return fallback
	}

	// 解密 API key
	apiKeyBytes, err := data.openCredential(cred.Nonce, cred.Ciphertext,
		[]byte(fmt.Sprintf("writing-model:%d", wm.ID)))
	if err != nil {
		slog.Warn("analyzeSentiment: 解密 API key 失败", "err", err)
		return fallback
	}
	apiKey := string(apiKeyBytes)
	defer func() {
		for i := range apiKeyBytes {
			apiKeyBytes[i] = 0
		}
	}()

	// 品牌主体描述
	subject := brandTerms[0]
	if enterpriseName != "" && enterpriseName != subject {
		subject = subject + "/" + enterpriseName
	}

	result := callLLMForSentiment(wm.BaseURL, wm.ModelID, apiKey, snippets, subject, wm.TimeoutSeconds)
	slog.Debug("analyzeSentiment: LLM 调用完成", "sentiment", result)
	return result
}

// extractBrandSnippets 在回答文本中定位包含品牌词/企业名称的句子片段。
// 以句末标点（。！？\n.!?）和 markdown 标题（#）为句子边界，将文本切分为
// 句子列表，选取包含品牌词的句子（前后各扩展 1 句作为上下文），去重后拼接。
// 避免全文送 LLM，排除其他品牌语句的干扰。
func extractBrandSnippets(answerText string, brandTerms []string, enterpriseName string) string {
	if answerText == "" || len(brandTerms) == 0 {
		return ""
	}
	// 将 markdown 标题标记替换为换行，使标题行也作为句子边界
	normalized := headerBoundaryRe.ReplaceAllString(answerText, "\n")

	// 以句末标点分割为句子列表（保留标点）
	sentenceEnds := "。！？\n.!?;；"
	sentences := splitSentences(normalized, sentenceEnds)
	if len(sentences) == 0 {
		return ""
	}

	// 构建搜索词列表
	terms := dedupeNonEmpty(append(brandTerms, enterpriseName))
	termLowers := make([]string, 0, len(terms))
	for _, t := range terms {
		if t != "" {
			termLowers = append(termLowers, strings.ToLower(t))
		}
	}

	// 标记包含品牌词的句子索引
	hit := make([]bool, len(sentences))
	for i, s := range sentences {
		sl := strings.ToLower(s)
		for _, tl := range termLowers {
			if strings.Contains(sl, tl) {
				hit[i] = true
				break
			}
		}
	}

	// 选取命中句子 + 前后各 1 句作为上下文
	var selected []string
	totalRunes := 0
	const maxTotalRunes = 3000
	for i := range sentences {
		if !hit[i] {
			continue
		}
		// 前一句
		if i > 0 && !hit[i-1] {
			snippet := strings.TrimSpace(sentences[i-1])
			if snippet != "" && totalRunes+len([]rune(snippet)) <= maxTotalRunes {
				selected = append(selected, snippet)
				totalRunes += len([]rune(snippet))
			}
		}
		// 命中句
		snippet := strings.TrimSpace(sentences[i])
		if snippet != "" && totalRunes+len([]rune(snippet)) <= maxTotalRunes {
			selected = append(selected, snippet)
			totalRunes += len([]rune(snippet))
		}
		// 后一句
		if i < len(sentences)-1 && !hit[i+1] {
			snippet = strings.TrimSpace(sentences[i+1])
			if snippet != "" && totalRunes+len([]rune(snippet)) <= maxTotalRunes {
				selected = append(selected, snippet)
				totalRunes += len([]rune(snippet))
			}
		}
	}
	return strings.Join(selected, "\n---\n")
}

// splitSentences 按句末标点将文本切分为句子列表，保留标点在句尾。
func splitSentences(text, ends string) []string {
	var sentences []string
	start := 0
	runes := []rune(text)
	endRunes := []rune(ends)
	endSet := make(map[rune]bool, len(endRunes))
	for _, r := range endRunes {
		endSet[r] = true
	}
	for i, r := range runes {
		if endSet[r] {
			sentences = append(sentences, string(runes[start:i+1]))
			start = i + 1
		}
	}
	if start < len(runes) {
		rest := strings.TrimSpace(string(runes[start:]))
		if rest != "" {
			sentences = append(sentences, rest)
		}
	}
	return sentences
}

// callLLMForSentiment 以 OpenAI compatible 协议调用 LLM 做情感分析。
// 输入为品牌上下文片段（非全文），超时上限 15s，失败时返回 neutral。
func callLLMForSentiment(baseURL, modelID, apiKey, snippets, subject string, timeoutSec uint32) string {
	const fallback = "neutral"

	systemPrompt := "你是情感分析专家。请判断以下AI回答片段对指定品牌/企业的情感倾向。只返回一个词：positive、negative 或 neutral，不要返回其他任何内容。直接返回结果，不要输出思考过程。"
	userPrompt := fmt.Sprintf("品牌/企业：%s\n\n包含该品牌的回答片段：\n%s\n\n请判断这些片段对该品牌的整体情感倾向，只返回 positive、negative 或 neutral。直接返回结果，不要输出思考过程。", subject, snippets)

	// max_tokens 设为 2048：思考型模型（如 deepseek-v4-pro）会先消耗 token 做 reasoning，
	// 再输出正式 content。太小会导致 reasoning 未完成就被截断，content 为空。
	payload := map[string]any{
		"model": modelID,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userPrompt},
		},
		"max_tokens":  2048,
		"temperature": 0,
	}
	body, _ := json.Marshal(payload)

	// base_url 可能已包含 /v1（如 https://api.deepseek.com/v1），
	// 也可能只是根域名（如 https://api.openai.com）。统一处理：去尾部斜杠后，
	// 若已以 /v1 结尾则不再重复拼接，直接附加 /chat/completions。
	trimmedBase := strings.TrimRight(baseURL, "/")
	var url string
	if strings.HasSuffix(trimmedBase, "/v1") {
		url = trimmedBase + "/chat/completions"
	} else {
		url = trimmedBase + "/v1/chat/completions"
	}
	slog.Info("callLLMForSentiment: 调用", "url", url, "model", modelID, "timeout_sec", timeoutSec)
	timeout := time.Duration(timeoutSec) * time.Second
	if timeout == 0 || timeout > 60*time.Second {
		timeout = 60 * time.Second
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		slog.Warn("callLLMForSentiment: 创建请求失败", "err", err)
		return fallback
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		slog.Warn("callLLMForSentiment: HTTP 调用失败", "err", err)
		return fallback
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		errBody, _ := io.ReadAll(resp.Body)
		slog.Warn("callLLMForSentiment: 非 200 响应", "status", resp.StatusCode, "body", string(errBody))
		return fallback
	}

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		slog.Warn("callLLMForSentiment: 读取响应失败", "err", err)
		return fallback
	}
	slog.Info("callLLMForSentiment: 响应", "body_len", len(respBody))

	// 解析 OpenAI compatible chat completion 响应
	var result struct {
		Choices []struct {
			Message struct {
				Content   string `json:"content"`
				Reasoning string `json:"reasoning_content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return fallback
	}
	if len(result.Choices) == 0 {
		return fallback
	}

	// 兼容思考型模型：优先取 Content，为空时取 ReasoningContent
	content := strings.ToLower(strings.TrimSpace(result.Choices[0].Message.Content))
	if content == "" {
		content = strings.ToLower(strings.TrimSpace(result.Choices[0].Message.Reasoning))
	}

	// 提取关键词（LLM 可能返回额外说明，取首个匹配词）
	if strings.Contains(content, "positive") {
		return "positive"
	}
	if strings.Contains(content, "negative") {
		return "negative"
	}
	if strings.Contains(content, "neutral") {
		return "neutral"
	}
	// 中文返回兼容
	if strings.Contains(content, "正面") || strings.Contains(content, "积极") {
		return "positive"
	}
	if strings.Contains(content, "负面") || strings.Contains(content, "消极") {
		return "negative"
	}
	return fallback
}
