package server

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-kratos/kratos/v3/errors"
	khttp "github.com/go-kratos/kratos/v3/transport/http"
	v1 "kratos-svr/api/user/v1"
	"kratos-svr/app/user/internal/data"
	"kratos-svr/app/user/internal/service"
	"kratos-svr/internal/authn"
	"kratos-svr/internal/data/model"

	"gorm.io/gorm"
)

// legacyEnterpriseHandler exposes the legacy /api/enterprise/* routes that the
// Electron client still calls, backed by the new /api/user/v1 domain model.
type legacyEnterpriseHandler struct {
	data   *data.Data
	auth   *service.AuthService
	authn  *authn.Manager
}

func (h *legacyEnterpriseHandler) Register(r *khttp.Router) {
	r.Handle("GET", "/api/enterprise/articles", h.listArticles)
	r.Handle("POST", "/api/enterprise/articles/batch-review", h.batchReviewArticles)
	r.Handle("GET", "/api/enterprise/tasks", h.listTasks)
	r.Handle("POST", "/api/enterprise/tasks/{task_id}/start", h.startTask)
	r.Handle("GET", "/api/client/enterprise/publish-stats", h.publishStats)
	r.Handle("PUT", "/api/enterprise/password", h.changePassword)
}

func (h *legacyEnterpriseHandler) authenticate(ctx khttp.Context) (context.Context, error) {
	authHeader := ctx.Header().Get("Authorization")
	if authHeader == "" {
		return nil, errors.Unauthorized("AUTH_REQUIRED", "authentication required")
	}
	fields := strings.Fields(authHeader)
	if len(fields) != 2 || !strings.EqualFold(fields[0], "Bearer") {
		return nil, errors.Unauthorized("AUTH_INVALID_TOKEN", "invalid or expired token")
	}
	claims, err := h.authn.Verify(fields[1], authn.TokenKindAccess)
	if err != nil {
		return nil, err
	}
	p := authn.Principal{
		SubjectID:    claims.SubjectID,
		EnterpriseID: claims.EnterpriseID,
		SubjectType:  claims.SubjectType,
		SessionID:    claims.SessionID,
	}
	return authn.WithPrincipal(ctx, p), nil
}

func (h *legacyEnterpriseHandler) enterpriseID(ctx context.Context) (uint64, error) {
	p, ok := authn.PrincipalFromContext(ctx)
	if !ok || p.EnterpriseID == 0 {
		return 0, errors.Forbidden("ENTERPRISE_CONTEXT_REQUIRED", "enterprise context required")
	}
	return p.EnterpriseID, nil
}

func (h *legacyEnterpriseHandler) listArticles(c khttp.Context) error {
	ctx, err := h.authenticate(c)
	if err != nil {
		return err
	}
	eid, err := h.enterpriseID(ctx)
	if err != nil {
		return err
	}

	q := c.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	if page <= 0 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(q.Get("page_size"))
	if pageSize <= 0 {
		pageSize = 20
	}
	status := q.Get("status")

	db := h.data.DB(ctx).Model(&model.Article{}).Where("enterprise_id = ?", eid)
	if status != "" {
		db = db.Where("status = ?", status)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return err
	}

	var rows []model.Article
	if err := db.Order("id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&rows).Error; err != nil {
		return err
	}

	items := make([]legacyArticleItem, 0, len(rows))
	for _, a := range rows {
		items = append(items, legacyArticleItem{
			ID:          int64(a.ID),
			Title:       a.Title,
			Content:     a.ContentHTML,
			Status:      a.Status,
			AiModelUsed: "",
			Category:    "",
			CoverImage:  "",
			SendCount:   0,
			CreatedAt:   formatLegacyTime(a.CreatedAt),
		})
	}

	return c.Result(http.StatusOK, legacyArticleListOut{Items: items, Total: int(total)})
}

func (h *legacyEnterpriseHandler) batchReviewArticles(c khttp.Context) error {
	ctx, err := h.authenticate(c)
	if err != nil {
		return err
	}
	eid, err := h.enterpriseID(ctx)
	if err != nil {
		return err
	}

	var req legacyBatchReviewIn
	if err := c.Bind(&req); err != nil {
		return err
	}
	if len(req.IDs) == 0 {
		return errors.BadRequest("INVALID_REQUEST", "ids is required")
	}

	target := map[string]string{
		"approve":        "normal",
		"normal":         "normal",
		"reject":         "disabled",
		"pending_review": "pending_review",
	}[req.Action]
	if target == "" {
		return errors.BadRequest("INVALID_ACTION", "unsupported action: "+req.Action)
	}

	ids := make([]uint64, 0, len(req.IDs))
	for _, raw := range req.IDs {
		id, err := strconv.ParseUint(fmt.Sprintf("%v", raw), 10, 64)
		if err != nil || id == 0 {
			return errors.BadRequest("INVALID_ARTICLE_ID", "invalid article id")
		}
		ids = append(ids, id)
	}

	res := h.data.DB(ctx).
		Model(&model.Article{}).
		Where("enterprise_id = ? AND id IN ?", eid, ids).
		Updates(map[string]any{"status": target, "version": gorm.Expr("version + 1")})
	if res.Error != nil {
		return res.Error
	}

	return c.Result(http.StatusOK, map[string]any{
		"success":      true,
		"updated":      res.RowsAffected,
		"targetStatus": target,
	})
}

func (h *legacyEnterpriseHandler) listTasks(c khttp.Context) error {
	ctx, err := h.authenticate(c)
	if err != nil {
		return err
	}
	eid, err := h.enterpriseID(ctx)
	if err != nil {
		return err
	}

	type taskRow struct {
		ID               uint64
		PublishPlanID    uint64
		PublishChannelID uint64
		Status           string
		ErrorMessage     string
		ScheduledAt      time.Time
		CreatedAt        time.Time
		CompletedAt      *time.Time
		ChannelName      string
		PlanName         string
	}

	var rows []taskRow
	if err := h.data.DB(ctx).Raw(`
		SELECT
			t.id,
			t.publish_plan_id,
			t.publish_channel_id,
			t.status,
			t.error_message,
			t.scheduled_at,
			t.created_at,
			t.completed_at,
			c.name AS channel_name,
			p.name AS plan_name
		 FROM pub_tasks t
		 JOIN pub_plans p ON p.id = t.publish_plan_id AND p.enterprise_id = t.enterprise_id
		 LEFT JOIN cfg_publish_channels c ON c.id = t.publish_channel_id
		 WHERE t.enterprise_id = ?
		 ORDER BY t.id DESC
		 LIMIT 100
	`, eid).Scan(&rows).Error; err != nil {
		return err
	}

	items := make([]legacyPublishTaskItem, 0, len(rows))
	for _, t := range rows {
		name := t.PlanName
		if name == "" {
			name = fmt.Sprintf("发布任务 #%d", t.ID)
		}
		startedAt := ""
		if t.CompletedAt != nil {
			startedAt = formatLegacyTime(*t.CompletedAt)
		}
		items = append(items, legacyPublishTaskItem{
			ID:                    int64(t.ID),
			TaskName:              name,
			ArticleCategory:       "",
			TaskType:              "publish",
			Platforms:             []string{t.ChannelName},
			DailyLimit:            0,
			IntervalMinSec:        2,
			IntervalMaxSec:        5,
			Status:                mapTaskStatus(t.Status),
			TaskStatus:            t.Status,
			ArticleIds:            []int64{},
			ArticleCount:          1,
			TotalCount:            1,
			CompletedCount:        completedCountForStatus(t.Status),
			TodayPublishCount:     0,
			MaxPublishCount:       0,
			DailyPerAccountLimit:  0,
			DeduplicationMode:     "",
			AiDeclaration:         "",
			ErrorMessage:          t.ErrorMessage,
			LastExecutedAt:        startedAt,
			LastWrittenAt:         "",
			CreatedAt:             formatLegacyTime(t.CreatedAt),
		})
	}

	return c.Result(http.StatusOK, legacyPublishTaskListOut{Items: items, Total: len(items)})
}

func (h *legacyEnterpriseHandler) startTask(c khttp.Context) error {
	ctx, err := h.authenticate(c)
	if err != nil {
		return err
	}
	eid, err := h.enterpriseID(ctx)
	if err != nil {
		return err
	}

	taskIDStr := c.Vars().Get("task_id")
	taskID, err := strconv.ParseUint(taskIDStr, 10, 64)
	if err != nil {
		return errors.BadRequest("INVALID_TASK_ID", "invalid task id")
	}

	var task model.PublishTask
	if err := h.data.DB(ctx).Where("enterprise_id = ? AND id = ?", eid, taskID).First(&task).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return errors.NotFound("TASK_NOT_FOUND", "task not found")
		}
		return err
	}

	// For tasks stuck in manual_action_required / failed, retry them.
	if task.Status == "failed" || task.Status == "manual_action_required" || task.Status == "expired" {
		res := h.data.DB(ctx).Model(&model.PublishTask{}).
			Where("enterprise_id = ? AND id = ? AND version = ? AND attempt_count < max_attempts", eid, taskID, task.Version).
			Updates(map[string]any{
				"status":       "queued",
				"scheduled_at": time.Now().UTC(),
				"version":      gorm.Expr("version + 1"),
			})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 1 {
			return c.Result(http.StatusOK, map[string]any{"success": true})
		}
	}

	// Otherwise resume the parent plan if it is paused.
	res := h.data.DB(ctx).Model(&model.PublishPlan{}).
		Where("enterprise_id = ? AND id = ? AND status = ?", eid, task.PublishPlanID, 2).
		Updates(map[string]any{"status": 1, "version": gorm.Expr("version + 1")})
	if res.Error != nil {
		return res.Error
	}
	return c.Result(http.StatusOK, map[string]any{"success": true})
}

func (h *legacyEnterpriseHandler) publishStats(c khttp.Context) error {
	ctx, err := h.authenticate(c)
	if err != nil {
		return err
	}
	eid, err := h.enterpriseID(ctx)
	if err != nil {
		return err
	}

	type statsRow struct {
		SuccessCount int64
		FailedCount  int64
		TodayCount   int64
	}
	var s statsRow
	if err := h.data.DB(ctx).Raw(`
		SELECT
			SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) AS success_count,
			SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
			SUM(CASE WHEN status = 'succeeded' AND DATE(completed_at) = CURDATE() THEN 1 ELSE 0 END) AS today_count
		FROM pub_tasks
		WHERE enterprise_id = ?
	`, eid).Scan(&s).Error; err != nil {
		return err
	}

	var publishedArticleCount int64
	if err := h.data.DB(ctx).Raw(`
		SELECT COUNT(*) FROM cnt_articles WHERE enterprise_id = ? AND published_at IS NOT NULL AND deleted_at IS NULL
	`, eid).Scan(&publishedArticleCount).Error; err != nil {
		return err
	}

	var pendingArticleCount int64
	if err := h.data.DB(ctx).Raw(`
		SELECT COUNT(*) FROM cnt_articles WHERE enterprise_id = ? AND status = 'normal' AND deleted_at IS NULL
	`, eid).Scan(&pendingArticleCount).Error; err != nil {
		return err
	}

	type platformRow struct {
		Platform string
		Label    string
		Count    int64
		Success  int64
	}
	var platformRows []platformRow
	if err := h.data.DB(ctx).Raw(`
		SELECT c.code AS platform, c.name AS label, COUNT(*) AS count,
			SUM(CASE WHEN t.status = 'succeeded' THEN 1 ELSE 0 END) AS success
		FROM pub_tasks t
		LEFT JOIN cfg_publish_channels c ON c.id = t.publish_channel_id AND c.deleted_at IS NULL
		WHERE t.enterprise_id = ?
		GROUP BY c.code, c.name
		ORDER BY count DESC
		LIMIT 10
	`, eid).Scan(&platformRows).Error; err != nil {
		return err
	}
	platformStats := make([]legacyPlatformStat, 0, len(platformRows))
	for _, v := range platformRows {
		rate := float64(0)
		if v.Count > 0 {
			rate = float64(v.Success) / float64(v.Count)
		}
		platformStats = append(platformStats, legacyPlatformStat{
			Platform: v.Platform, Label: v.Label, Count: v.Count, SuccessRate: rate,
		})
	}

	return c.Result(http.StatusOK, legacyPublishStatsOut{
		TotalPublished:        s.SuccessCount + s.FailedCount,
		SuccessCount:          s.SuccessCount,
		FailedCount:           s.FailedCount,
		TodayCount:            s.TodayCount,
		PublishedArticleCount: publishedArticleCount,
		PendingArticleCount:   pendingArticleCount,
		PlatformStats:         platformStats,
	})
}

func (h *legacyEnterpriseHandler) changePassword(c khttp.Context) error {
	ctx, err := h.authenticate(c)
	if err != nil {
		return err
	}
	if _, err := h.enterpriseID(ctx); err != nil {
		return err
	}

	var req legacyPasswordChangeIn
	if err := c.Bind(&req); err != nil {
		return err
	}

	_, err = h.auth.ChangePassword(ctx, &v1.ChangePasswordRequest{
		CurrentPassword: req.OldPassword,
		NewPassword:     req.NewPassword,
	})
	if err != nil {
		return err
	}

	return c.Result(http.StatusOK, map[string]any{"success": true})
}

func formatLegacyTime(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.UTC().Format(time.RFC3339)
}

func mapTaskStatus(status string) string {
	switch status {
	case "succeeded":
		return "completed"
	case "failed", "manual_action_required", "expired":
		return "failed"
	case "queued", "leased":
		return "running"
	case "cancelled":
		return "cancelled"
	default:
		return status
	}
}

func completedCountForStatus(status string) int {
	if status == "succeeded" {
		return 1
	}
	return 0
}

type legacyArticleListOut struct {
	Items []legacyArticleItem `json:"items"`
	Total int                 `json:"total"`
}

type legacyArticleItem struct {
	ID          int64  `json:"id"`
	Title       string `json:"title"`
	Content     string `json:"content"`
	Status      string `json:"status"`
	AiModelUsed string `json:"ai_model_used"`
	Category    string `json:"category"`
	CoverImage  string `json:"cover_image"`
	SendCount   int    `json:"send_count"`
	CreatedAt   string `json:"created_at"`
}

type legacyPublishTaskListOut struct {
	Items []legacyPublishTaskItem `json:"items"`
	Total int                     `json:"total"`
}

type legacyPublishTaskItem struct {
	ID                   int64    `json:"id"`
	TaskName             string   `json:"task_name"`
	ArticleCategory      string   `json:"article_category"`
	TaskType             string   `json:"task_type"`
	Platforms            []string `json:"platforms"`
	DailyLimit           int      `json:"daily_limit"`
	IntervalMinSec       int      `json:"interval_min_sec"`
	IntervalMaxSec       int      `json:"interval_max_sec"`
	Status               string   `json:"status"`
	TaskStatus           string   `json:"task_status"`
	ArticleIds           []int64  `json:"article_ids"`
	ArticleCount         int      `json:"article_count"`
	TotalCount           int      `json:"total_count"`
	CompletedCount       int      `json:"completed_count"`
	TodayPublishCount    int      `json:"today_publish_count"`
	MaxPublishCount      int      `json:"max_publish_count"`
	DailyPerAccountLimit int      `json:"daily_per_account_limit"`
	DeduplicationMode    string   `json:"deduplication_mode"`
	AiDeclaration        string   `json:"ai_declaration"`
	ErrorMessage         string   `json:"error_message"`
	LastExecutedAt       string   `json:"last_executed_at"`
	LastWrittenAt        string   `json:"last_written_at"`
	CreatedAt            string   `json:"created_at"`
}

type legacyPlatformStat struct {
	Platform    string  `json:"platform"`
	Label       string  `json:"label"`
	Count       int64   `json:"count"`
	SuccessRate float64 `json:"success_rate"`
}

type legacyPublishStatsOut struct {
	TotalPublished        int64                `json:"total_published"`
	SuccessCount          int64                `json:"success_count"`
	FailedCount           int64                `json:"failed_count"`
	TodayCount            int64                `json:"today_count"`
	PublishedArticleCount int64                `json:"published_article_count"`
	PendingArticleCount   int64                `json:"pending_article_count"`
	PlatformStats         []legacyPlatformStat `json:"platform_stats"`
}

type legacyPasswordChangeIn struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password"`
}

type legacyBatchReviewIn struct {
	IDs    []any  `json:"ids"`
	Action string `json:"action"`
}
