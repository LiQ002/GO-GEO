package biz

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/go-kratos/kratos/v3/errors"
)

var (
	ErrPublishTaskNotFound = errors.NotFound("PUBLISH_TASK_NOT_FOUND", "publish task not found")
	ErrPublishTaskInvalid  = errors.BadRequest("PUBLISH_TASK_INVALID", "invalid publish task operation")
	ErrPublishTaskConflict = errors.Conflict("PUBLISH_TASK_CONFLICT", "publish task data has changed")
)

type AdminPublishTask struct {
	ID, EnterpriseID, PublishPlanID, ArticleSnapshotID, PublishChannelID uint64
	EnterpriseName, PublishPlanName, ArticleTitle, PublishChannelName    string
	PublishTargetID, PlatformAccountID                                   *uint64
	PublishTargetName, ExecutionMode, Status                             string
	Priority                                                             int32
	ScheduledAt                                                          time.Time
	NextRetryAt                                                          *time.Time
	AttemptCount, MaxAttempts                                            uint32
	ResultURL, PlatformArticleID, ErrorCategory, ErrorCode, ErrorMessage string
	CompletedAt                                                          *time.Time
	Version                                                              uint64
	CreatedAt, UpdatedAt                                                 time.Time
}

type AdminPublishAttempt struct {
	ID                                                                              uint64
	AttemptNumber                                                                   uint32
	WorkerNodeID, LeaseID                                                           uint64
	Status                                                                          string
	StartedAt                                                                       time.Time
	FinishedAt                                                                      *time.Time
	DurationMS                                                                      uint64
	ResultJSON, EvidenceJSON, ErrorCategory, ErrorCode, ErrorMessage, ClientVersion string
}

type AdminSubmissionReceipt struct {
	ID                                   uint64
	ReceiptType, ReceiptCode, Status     string
	SubmittedAt, ExpectedAt, PublishedAt *time.Time
	PublishedURL                         string
	CostMinorUnits                       int64
	Currency, FollowUpJSON               string
}

type AdminPublishTaskDetail struct {
	Task     *AdminPublishTask
	Attempts []*AdminPublishAttempt
	Receipt  *AdminSubmissionReceipt
}

type AdminPublishTaskListOptions struct {
	Offset, Limit                  int
	EnterpriseID, PublishChannelID uint64
	Status, ErrorCategory, Keyword string
}
type AdminPublishTaskAction struct {
	ID, Version, OperatorID uint64
	Action, Reason          string
}
type AdminReceiptCommand struct {
	TaskID, OperatorID uint64
	Receipt            *AdminSubmissionReceipt
	Reason             string
}

type AdminPublishTaskRepo interface {
	List(context.Context, AdminPublishTaskListOptions) ([]*AdminPublishTask, int64, error)
	Get(context.Context, uint64) (*AdminPublishTaskDetail, error)
	ChangeStatus(context.Context, AdminPublishTaskAction) (*AdminPublishTaskDetail, error)
	SaveReceipt(context.Context, AdminReceiptCommand) (*AdminPublishTaskDetail, error)
}
type AdminPublishTaskUsecase struct{ repo AdminPublishTaskRepo }

func NewAdminPublishTaskUsecase(repo AdminPublishTaskRepo) *AdminPublishTaskUsecase {
	return &AdminPublishTaskUsecase{repo: repo}
}
func (uc *AdminPublishTaskUsecase) List(ctx context.Context, opts AdminPublishTaskListOptions) ([]*AdminPublishTask, int64, error) {
	return uc.repo.List(ctx, opts)
}
func (uc *AdminPublishTaskUsecase) Get(ctx context.Context, id uint64) (*AdminPublishTaskDetail, error) {
	if id == 0 {
		return nil, ErrPublishTaskInvalid
	}
	return uc.repo.Get(ctx, id)
}
func (uc *AdminPublishTaskUsecase) ChangeStatus(ctx context.Context, cmd AdminPublishTaskAction) (*AdminPublishTaskDetail, error) {
	if cmd.ID == 0 || cmd.Version == 0 || cmd.OperatorID == 0 || strings.TrimSpace(cmd.Reason) == "" || (cmd.Action != "retry" && cmd.Action != "cancel") {
		return nil, ErrPublishTaskInvalid
	}
	return uc.repo.ChangeStatus(ctx, cmd)
}
func (uc *AdminPublishTaskUsecase) SaveReceipt(ctx context.Context, cmd AdminReceiptCommand) (*AdminPublishTaskDetail, error) {
	if cmd.TaskID == 0 || cmd.OperatorID == 0 || cmd.Receipt == nil || strings.TrimSpace(cmd.Receipt.ReceiptType) == "" || strings.TrimSpace(cmd.Receipt.Status) == "" || strings.TrimSpace(cmd.Reason) == "" {
		return nil, ErrPublishTaskInvalid
	}
	if cmd.Receipt.FollowUpJSON != "" && !json.Valid([]byte(cmd.Receipt.FollowUpJSON)) {
		return nil, ErrPublishTaskInvalid
	}
	return uc.repo.SaveReceipt(ctx, cmd)
}
