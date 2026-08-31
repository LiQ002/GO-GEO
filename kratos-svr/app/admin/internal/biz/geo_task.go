package biz

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/go-kratos/kratos/v3/errors"
)

var (
	ErrGeoTaskNotFound = errors.NotFound("GEO_TASK_NOT_FOUND", "GEO task not found")
	ErrGeoTaskInvalid  = errors.BadRequest("GEO_TASK_INVALID", "invalid GEO task operation")
	ErrGeoTaskConflict = errors.Conflict("GEO_TASK_CONFLICT", "GEO task data has changed")
)

type AdminGeoTask struct {
	ID, EnterpriseID, BrandID, QuestionID, InclusionSiteID     uint64
	EnterpriseName, BrandName, QuestionText, InclusionSiteName string
	MonitorPlanID, PlatformAccountID                           *uint64
	MonitorPlanName, ModelEntry, Locale, Region, Status        string
	Priority, TerminalType                                     int32
	ScheduledAt                                                time.Time
	AttemptCount, MaxAttempts                                  uint32
	ErrorCategory, ErrorCode, ErrorMessage                     string
	CompletedAt                                                *time.Time
	Version                                                    uint64
	CreatedAt, UpdatedAt                                       time.Time
	BrandMentioned                                             bool
	SessionRef                                                 string
}
type AdminAnswerSnapshot struct {
	ID, AttemptID                                                                               uint64
	ModelEntry, QuestionText, AnswerText, AnswerStatus, ScreenshotKey, EvidenceJSON, SessionRef string
	ObservedAt                                                                                  time.Time
	ClientVersion                                                                               string
}
type AdminCitation struct {
	ID                 uint64
	URL, Domain, Title string
	Position           uint32
	IsEnterpriseSource bool
	ArticleID          *uint64
	MetadataJSON       string
}
type AdminMention struct {
	ID         uint64
	EntityType string
	EntityID   uint64
	Text       string
	Position   uint32
	Sentiment  string
	Confidence float64
}
type AdminAnalysisResult struct {
	ID                                         uint64
	AnalysisVersion                            uint32
	RuleVersion, Status                        string
	BrandMentioned, EnterpriseCited            bool
	VisibilityScore, AccuracyScore, Confidence float64
	ResultJSON                                 string
}
type AdminManualReview struct {
	ID, AnswerSnapshotID, ReviewerID uint64
	AnalysisResultID                 *uint64
	BeforeJSON, AfterJSON, Reason    string
	CreatedAt                        time.Time
}
type AdminGeoTaskDetail struct {
	Task      *AdminGeoTask
	Answer    *AdminAnswerSnapshot
	Citations []*AdminCitation
	Mentions  []*AdminMention
	Analysis  *AdminAnalysisResult
	Reviews   []*AdminManualReview
}
type AdminGeoTaskListOptions struct {
	Offset, Limit                  int
	EnterpriseID, InclusionSiteID  uint64
	Status, ErrorCategory, Keyword string
}
type AdminGeoTaskAction struct {
	ID, Version, OperatorID uint64
	Action, Reason          string
}
type AdminManualReviewCommand struct {
	TaskID, AnswerSnapshotID, OperatorID uint64
	AnalysisResultID                     *uint64
	BeforeJSON, AfterJSON, Reason        string
}

type AdminGeoTaskRepo interface {
	List(context.Context, AdminGeoTaskListOptions) ([]*AdminGeoTask, int64, error)
	Get(context.Context, uint64) (*AdminGeoTaskDetail, error)
	ChangeStatus(context.Context, AdminGeoTaskAction) (*AdminGeoTaskDetail, error)
	CreateManualReview(context.Context, AdminManualReviewCommand) (*AdminGeoTaskDetail, error)
}
type AdminGeoTaskUsecase struct{ repo AdminGeoTaskRepo }

func NewAdminGeoTaskUsecase(repo AdminGeoTaskRepo) *AdminGeoTaskUsecase {
	return &AdminGeoTaskUsecase{repo: repo}
}
func (uc *AdminGeoTaskUsecase) List(ctx context.Context, opts AdminGeoTaskListOptions) ([]*AdminGeoTask, int64, error) {
	return uc.repo.List(ctx, opts)
}
func (uc *AdminGeoTaskUsecase) Get(ctx context.Context, id uint64) (*AdminGeoTaskDetail, error) {
	if id == 0 {
		return nil, ErrGeoTaskInvalid
	}
	return uc.repo.Get(ctx, id)
}
func (uc *AdminGeoTaskUsecase) ChangeStatus(ctx context.Context, cmd AdminGeoTaskAction) (*AdminGeoTaskDetail, error) {
	if cmd.ID == 0 || cmd.Version == 0 || cmd.OperatorID == 0 || strings.TrimSpace(cmd.Reason) == "" || (cmd.Action != "retry" && cmd.Action != "cancel") {
		return nil, ErrGeoTaskInvalid
	}
	return uc.repo.ChangeStatus(ctx, cmd)
}
func (uc *AdminGeoTaskUsecase) CreateManualReview(ctx context.Context, cmd AdminManualReviewCommand) (*AdminGeoTaskDetail, error) {
	if cmd.TaskID == 0 || cmd.AnswerSnapshotID == 0 || cmd.OperatorID == 0 || strings.TrimSpace(cmd.Reason) == "" || !json.Valid([]byte(cmd.AfterJSON)) {
		return nil, ErrGeoTaskInvalid
	}
	if cmd.BeforeJSON != "" && !json.Valid([]byte(cmd.BeforeJSON)) {
		return nil, ErrGeoTaskInvalid
	}
	return uc.repo.CreateManualReview(ctx, cmd)
}
