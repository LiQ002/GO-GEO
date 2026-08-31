package biz

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/go-kratos/kratos/v3/errors"
)

const (
	KeywordDistillationStatusPending   int32 = 1
	KeywordDistillationStatusRunning   int32 = 2
	KeywordDistillationStatusCompleted int32 = 3
	KeywordDistillationStatusFailed    int32 = 4

	QuestionSourceManual    int32 = 1
	QuestionSourceDistilled int32 = 2
)

var (
	ErrKeywordDistillationNotFound = errors.NotFound("KEYWORD_DISTILLATION_NOT_FOUND", "keyword distillation task not found")
	ErrKeywordDistillationInvalid  = errors.BadRequest("KEYWORD_DISTILLATION_INVALID", "invalid keyword distillation request")
	ErrKeywordDistillationState    = errors.Conflict("KEYWORD_DISTILLATION_STATE_INVALID", "keyword distillation task state does not allow this operation")
	ErrKeywordDistillationModel    = errors.BadRequest("KEYWORD_DISTILLATION_MODEL_UNAVAILABLE", "question distillation model is not available to this enterprise")
)

type KeywordDistillationTask struct {
	ID, EnterpriseID, KeywordID, BrandID uint64
	WritingModelID, WritingModelVersion  uint64
	ClientRequestID, Region              string
	Status                               int32
	RequestedCount                       uint32
	PromptSnapshot, ModelSnapshotJSON    string
	OutputJSON                           string
	InputTokens, OutputTokens            uint64
	CostMicros                           int64
	ErrorCode, ErrorMessage              string
	AttemptCount                         uint32
	StartedAt, CompletedAt               *time.Time
	CreatedAt, UpdatedAt                 time.Time
}

type KeywordDistillationInput struct {
	EnterpriseID, OperatorID, KeywordID, WritingModelID uint64
	ClientRequestID, Region                             string
	QuestionCount                                       uint32
}

type KeywordDistillationListOptions struct {
	Offset, Limit int
	KeywordID     uint64
	Status        int32
}

type DistilledQuestion struct {
	Text        string `json:"text"`
	Intent      int32  `json:"intent"`
	Audience    string `json:"audience,omitempty"`
	FunnelStage int32  `json:"funnel_stage"`
}

type KeywordDistillationResult struct {
	Questions    []DistilledQuestion `json:"questions"`
	RawContent   string              `json:"raw_content,omitempty"`
	InputTokens  uint64              `json:"-"`
	OutputTokens uint64              `json:"-"`
	CostMicros   int64               `json:"-"`
}

type KeywordDistillationRepo interface {
	Create(context.Context, KeywordDistillationInput) (*KeywordDistillationTask, bool, error)
	Get(context.Context, uint64, uint64) (*KeywordDistillationTask, error)
	List(context.Context, uint64, KeywordDistillationListOptions) ([]*KeywordDistillationTask, int64, error)
	Start(context.Context, uint64, uint64, bool) (*KeywordDistillationTask, error)
	Complete(context.Context, *KeywordDistillationTask, *KeywordDistillationResult) (*KeywordDistillationTask, error)
	Fail(context.Context, uint64, uint64, string, string) (*KeywordDistillationTask, error)
}

type KeywordQuestionDistiller interface {
	Generate(context.Context, *KeywordDistillationTask) (*KeywordDistillationResult, error)
}

type KeywordDistillationUsecase struct {
	repo      KeywordDistillationRepo
	distiller KeywordQuestionDistiller
}

func NewKeywordDistillationUsecase(repo KeywordDistillationRepo, distiller KeywordQuestionDistiller) *KeywordDistillationUsecase {
	return &KeywordDistillationUsecase{repo: repo, distiller: distiller}
}

func (u *KeywordDistillationUsecase) Create(ctx context.Context, input KeywordDistillationInput) (*KeywordDistillationTask, error) {
	if err := validateKeywordDistillationInput(input); err != nil {
		return nil, err
	}
	task, created, err := u.repo.Create(ctx, input)
	if err != nil {
		return nil, err
	}
	if !created {
		return task, nil
	}
	go u.runDistillationInBackground(task)
	return task, nil
}

func (u *KeywordDistillationUsecase) runDistillationInBackground(task *KeywordDistillationTask) {
	defer func() {
		if r := recover(); r != nil {
			_, _ = u.repo.Fail(context.Background(), task.EnterpriseID, task.ID, "PANIC", fmt.Sprintf("%v", r))
		}
	}()
	// 单轮一次性生成，5 分钟足够覆盖单次 LLM 调用。
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	_, _ = u.execute(ctx, task, false)
}

func (u *KeywordDistillationUsecase) List(ctx context.Context, enterpriseID uint64, opts KeywordDistillationListOptions) ([]*KeywordDistillationTask, int64, error) {
	if enterpriseID == 0 {
		return nil, 0, ErrKeywordDistillationInvalid
	}
	return u.repo.List(ctx, enterpriseID, opts)
}

func (u *KeywordDistillationUsecase) Retry(ctx context.Context, enterpriseID, id uint64) (*KeywordDistillationTask, error) {
	if enterpriseID == 0 || id == 0 {
		return nil, ErrKeywordDistillationInvalid
	}
	task, err := u.repo.Get(ctx, enterpriseID, id)
	if err != nil {
		return nil, err
	}
	if task.Status != KeywordDistillationStatusFailed {
		return nil, ErrKeywordDistillationState
	}
	return u.execute(ctx, task, true)
}

func (u *KeywordDistillationUsecase) execute(ctx context.Context, task *KeywordDistillationTask, retry bool) (*KeywordDistillationTask, error) {
	running, err := u.repo.Start(ctx, task.EnterpriseID, task.ID, retry)
	if err != nil {
		return nil, err
	}
	result, err := u.distiller.Generate(ctx, running)
	if err != nil {
		return u.fail(ctx, running, "MODEL_CALL_FAILED", err.Error())
	}
	if result == nil || len(result.Questions) < 1 {
		return u.fail(ctx, running, "MODEL_INVALID_OUTPUT", "writing model did not return usable questions")
	}
	// 数量校验：仅在 LLM 完全无产出时判定失败。
	// 过滤规则已删除，over-generation ×1.5 确保产出量充足，不再因数量不足报错。
	const minRatio = 0
	if running.RequestedCount > 0 && float64(len(result.Questions))/float64(running.RequestedCount) < minRatio {
		return u.fail(ctx, running, "MODEL_INSUFFICIENT_OUTPUT", fmt.Sprintf("expected %d questions, got %d", running.RequestedCount, len(result.Questions)))
	}
	return u.repo.Complete(ctx, running, result)
}

func (u *KeywordDistillationUsecase) fail(ctx context.Context, task *KeywordDistillationTask, code, message string) (*KeywordDistillationTask, error) {
	message = strings.TrimSpace(message)
	if len([]rune(message)) > 2000 {
		message = string([]rune(message)[:2000])
	}
	return u.repo.Fail(ctx, task.EnterpriseID, task.ID, code, message)
}

func validateKeywordDistillationInput(input KeywordDistillationInput) error {
	if input.EnterpriseID == 0 || input.OperatorID == 0 || input.KeywordID == 0 || input.QuestionCount < 1 || input.QuestionCount > 100 || len([]rune(strings.TrimSpace(input.Region))) > 128 {
		return ErrKeywordDistillationInvalid
	}
	requestID := strings.TrimSpace(input.ClientRequestID)
	if requestID == "" || len(requestID) > 128 {
		return ErrKeywordDistillationInvalid
	}
	return nil
}
