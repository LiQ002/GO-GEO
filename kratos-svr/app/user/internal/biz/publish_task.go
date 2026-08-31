package biz

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/go-kratos/kratos/v3/errors"
	"time"
)

var (
	ErrPublishPlanNotFound       = errors.NotFound("PUBLISH_PLAN_NOT_FOUND", "publish plan not found")
	ErrPublishPlanInvalid        = errors.BadRequest("PUBLISH_PLAN_INVALID", "invalid publish plan")
	ErrPublishPlanConflict       = errors.Conflict("PUBLISH_PLAN_CONFLICT", "publish plan version conflict")
	ErrPublishQuota              = errors.Forbidden("PUBLISH_QUOTA_EXCEEDED", "达到套餐设定额度，请升级套餐或联系管理员")
	ErrPublishArticleNotApproved = errors.BadRequest("PUBLISH_ARTICLE_NOT_APPROVED", "article must be approved before publishing")
	ErrPublishDedupConflict      = errors.Conflict("PUBLISH_DEDUP_CONFLICT", "article already has an active publish task for this target")
)

type PublishPlan struct {
	ID, EnterpriseID                                uint64
	ArticleID, ArticleSnapshotID                    *uint64 // 历史兼容；新计划置 nil
	Name, ArticleTitle, Timezone, FailurePolicyJSON, ClientRequestID, DedupStrategy string
	Status, ScheduleType                               int32
	ScheduledAt                                        *time.Time
	Version                                            uint64
	CreatedAt                                          time.Time
	// 列表展示用摘要：多文章×多平台计划的聚合进度
	ArticleCount, PlatformCount, TaskCount, SucceededCount, FailedCount int32
}
type PublishTask struct {
	ID, EnterpriseID, PublishPlanID, ArticleID, PublishChannelID, PublishTargetID, PlatformAccountID       uint64
	ArticleSnapshotID                                                                    uint64
	ExecutionMode, Status, ResultURL, PlatformArticleID, ErrorCategory, ErrorCode, ErrorMessage string
	ResultJSON, EvidenceJSON                                                                    string
	Priority                                                                                    int32
	ScheduledAt                                                                                 time.Time
	AttemptCount, MaxAttempts                                                                   uint32
	CompletedAt                                                                                 *time.Time
	Version                                                                                     uint64
}
// ArticleInput 创建投放计划时的文章输入项（文章 ID + 快照 ID 配对）。
type ArticleInput struct {
	ArticleID         uint64
	ArticleSnapshotID uint64
}
type PublishTargetInput struct {
	PublishChannelID, PublishTargetID, PlatformAccountID uint64
	ExecutionMode                                        string
	Priority                                             int32
}
// AssignTask 表示经策略计算后需要写入 pub_tasks 的一条任务（文章 × 平台）。
type AssignTask struct {
	ArticleInput
	PublishTargetInput
}
type PublishPlanListOptions struct {
	Offset, Limit int
	Status        int32
	ArticleID     uint64
}
type PublishTaskListOptions struct {
	Offset, Limit int
}

type PublishTaskRepo interface {
	CreatePlan(context.Context, *PublishPlan, []AssignTask) (*PublishPlan, error)
	GetPlan(context.Context, uint64, uint64) (*PublishPlan, []*PublishTask, error)
	ListPlans(context.Context, uint64, PublishPlanListOptions) ([]*PublishPlan, int64, error)
	ChangePlanStatus(context.Context, uint64, uint64, uint64, string) (*PublishPlan, error)
	RetryTask(context.Context, uint64, uint64, uint64) (*PublishTask, error)
	ListSucceededTasks(context.Context, uint64, PublishTaskListOptions) ([]*PublishTask, int64, error)
	// DedupCheck 去重检查：返回指定文章+渠道是否已有非失败任务。
	// allUnique 模式下 channelID 传 0（仅按文章查）。
	DedupCheck(ctx context.Context, enterpriseID, articleID, channelID uint64) (bool, error)
}
type PublishTaskUsecase struct{ repo PublishTaskRepo }

func NewPublishTaskUsecase(r PublishTaskRepo) *PublishTaskUsecase {
	return &PublishTaskUsecase{repo: r}
}
func (u *PublishTaskUsecase) Create(c context.Context, p *PublishPlan, articles []ArticleInput, targets []PublishTargetInput) (*PublishPlan, error) {
	if p == nil {
		return nil, errors.BadRequest("PUBLISH_PLAN_INVALID", "invalid publish plan: plan is nil")
	}
	if p.EnterpriseID == 0 {
		return nil, errors.BadRequest("PUBLISH_PLAN_INVALID", "invalid publish plan: enterprise_id is required")
	}
	if p.ClientRequestID == "" {
		return nil, errors.BadRequest("PUBLISH_PLAN_INVALID", "invalid publish plan: client_request_id is required")
	}
	if len(articles) == 0 {
		return nil, errors.BadRequest("PUBLISH_PLAN_INVALID", "invalid publish plan: at least one article is required")
	}
	if len(targets) == 0 {
		return nil, errors.BadRequest("PUBLISH_PLAN_INVALID", "invalid publish plan: at least one target is required")
	}
	if p.FailurePolicyJSON != "" && !json.Valid([]byte(p.FailurePolicyJSON)) {
		return nil, errors.BadRequest("PUBLISH_PLAN_INVALID", "invalid publish plan: failure_policy_json is invalid json")
	}
	if p.ScheduleType != PublishScheduleImmediate && p.ScheduleType != PublishScheduleScheduled {
		return nil, errors.BadRequest("PUBLISH_PLAN_INVALID", "invalid publish plan: schedule_type is invalid")
	}
	if p.ScheduleType == PublishScheduleScheduled && p.ScheduledAt == nil {
		return nil, errors.BadRequest("PUBLISH_PLAN_INVALID", "invalid publish plan: scheduled_at is required for scheduled plan")
	}
	// 默认去重策略为 no_dedup，校验传入值合法性
	if p.DedupStrategy == "" {
		p.DedupStrategy = DedupStrategyNone
	}
	if p.DedupStrategy != DedupStrategyNone && p.DedupStrategy != DedupStrategyAllUnique && p.DedupStrategy != DedupStrategyPerPlatform {
		return nil, errors.BadRequest("PUBLISH_PLAN_INVALID", "invalid publish plan: dedup_strategy is invalid")
	}
	// 校验文章输入合法性
	for i, a := range articles {
		if a.ArticleID == 0 {
			return nil, errors.BadRequest("PUBLISH_PLAN_INVALID", fmt.Sprintf("invalid publish plan: article_ids[%d] is required", i))
		}
		if a.ArticleSnapshotID == 0 {
			return nil, errors.BadRequest("PUBLISH_PLAN_INVALID", fmt.Sprintf("invalid publish plan: article_snapshot_ids[%d] is required", i))
		}
	}

	// 按策略生成任务矩阵（设计文档 §4.3）
	assignments, err := u.buildAssignments(c, p, articles, targets)
	if err != nil {
		return nil, err
	}
	if len(assignments) == 0 {
		return nil, errors.Conflict("PUBLISH_DEDUP_CONFLICT", "all articles are skipped by dedup strategy")
	}

	// 新计划不再绑定单篇文章：清空 ArticleID/ArticleSnapshotID（保留字段为 nil）
	p.ArticleID = nil
	p.ArticleSnapshotID = nil
	return u.repo.CreatePlan(c, p, assignments)
}

// buildAssignments 按去重策略生成文章×平台任务列表。
// - all_unique：每篇文章只分配一个平台（按轮询 i % len(targets)），并查文章是否已存在任务。
// - per_platform：每篇文章投所有平台，按 (article_id, channel_id) 去重。
// - no_dedup：每篇文章投所有平台，不去重。
func (u *PublishTaskUsecase) buildAssignments(ctx context.Context, p *PublishPlan, articles []ArticleInput, targets []PublishTargetInput) ([]AssignTask, error) {
	assignments := make([]AssignTask, 0, len(articles)*len(targets))
	switch p.DedupStrategy {
	case DedupStrategyAllUnique:
		for i, art := range articles {
			// 全部去重：按文章查（channelID=0）
			exists, err := u.repo.DedupCheck(ctx, p.EnterpriseID, art.ArticleID, 0)
			if err != nil {
				return nil, err
			}
			if exists {
				continue
			}
			target := targets[i%len(targets)]
			assignments = append(assignments, AssignTask{ArticleInput: art, PublishTargetInput: target})
		}
	case DedupStrategyPerPlatform:
		for _, art := range articles {
			for _, target := range targets {
				exists, err := u.repo.DedupCheck(ctx, p.EnterpriseID, art.ArticleID, target.PublishChannelID)
				if err != nil {
					return nil, err
				}
				if exists {
					continue
				}
				assignments = append(assignments, AssignTask{ArticleInput: art, PublishTargetInput: target})
			}
		}
	default: // no_dedup
		for _, art := range articles {
			for _, target := range targets {
				assignments = append(assignments, AssignTask{ArticleInput: art, PublishTargetInput: target})
			}
		}
	}
	return assignments, nil
}
func (u *PublishTaskUsecase) Get(c context.Context, e, id uint64) (*PublishPlan, []*PublishTask, error) {
	return u.repo.GetPlan(c, e, id)
}
func (u *PublishTaskUsecase) List(c context.Context, e uint64, o PublishPlanListOptions) ([]*PublishPlan, int64, error) {
	return u.repo.ListPlans(c, e, o)
}
func (u *PublishTaskUsecase) Change(c context.Context, e, id, v uint64, a string) (*PublishPlan, error) {
	if !map[string]bool{"pause": true, "resume": true, "cancel": true, "stop": true}[a] {
		return nil, ErrPublishPlanInvalid
	}
	return u.repo.ChangePlanStatus(c, e, id, v, a)
}
func (u *PublishTaskUsecase) Retry(c context.Context, e, id, v uint64) (*PublishTask, error) {
	return u.repo.RetryTask(c, e, id, v)
}
func (u *PublishTaskUsecase) ListSucceeded(c context.Context, e uint64, o PublishTaskListOptions) ([]*PublishTask, int64, error) {
	return u.repo.ListSucceededTasks(c, e, o)
}
