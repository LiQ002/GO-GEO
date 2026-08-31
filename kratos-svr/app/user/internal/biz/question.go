package biz

import (
	"context"
	"github.com/go-kratos/kratos/v3/errors"
	"strings"
	"time"
)

var (
	ErrQuestionNotFound = errors.NotFound("QUESTION_NOT_FOUND", "question not found")
	ErrQuestionInvalid  = errors.BadRequest("QUESTION_INVALID", "invalid question")
	ErrQuestionConflict = errors.Conflict("QUESTION_CONFLICT", "question version conflict")
)

type Question struct {
	ID, EnterpriseID, KeywordID, BrandID, DistillationTaskID uint64
	Text, Region, Audience, ClusterCode                      string
	Status, Intent, FunnelStage, Source                      int32
	Priority, SortOrder                                      int32
	Version                                                  uint64
	CreatedAt, UpdatedAt                                     time.Time
}
type QuestionListOptions struct {
	Offset, Limit      int
	BrandID, KeywordID uint64
	Status             int32
	Keyword            string
}
type QuestionRepo interface {
	Create(context.Context, *Question) (*Question, error)
	Get(context.Context, uint64, uint64) (*Question, error)
	List(context.Context, uint64, QuestionListOptions) ([]*Question, int64, error)
	Update(context.Context, *Question) (*Question, error)
	Delete(context.Context, uint64, uint64, uint64) error
	Review(context.Context, uint64, uint64, uint64, string, string) (*Question, error)
}
type QuestionUsecase struct{ repo QuestionRepo }

func NewQuestionUsecase(r QuestionRepo) *QuestionUsecase { return &QuestionUsecase{repo: r} }
func (u *QuestionUsecase) Create(c context.Context, i *Question) (*Question, error) {
	if i != nil {
		if i.Status == 0 {
			i.Status = QuestionStatusPending
		}
		if i.Intent == 0 {
			i.Intent = QuestionIntentResearch
		}
		if i.FunnelStage == 0 {
			i.FunnelStage = QuestionFunnelConsideration
		}
		if i.Source == 0 {
			i.Source = QuestionSourceManual
		}
	}
	if x := validateQuestion(i); x != nil {
		return nil, x
	}
	return u.repo.Create(c, i)
}
func (u *QuestionUsecase) Get(c context.Context, e, id uint64) (*Question, error) {
	return u.repo.Get(c, e, id)
}
func (u *QuestionUsecase) List(c context.Context, e uint64, o QuestionListOptions) ([]*Question, int64, error) {
	return u.repo.List(c, e, o)
}
func (u *QuestionUsecase) Update(c context.Context, i *Question) (*Question, error) {
	if i == nil || i.ID == 0 || i.Version == 0 {
		return nil, ErrQuestionInvalid
	}
	if x := validateQuestion(i); x != nil {
		return nil, x
	}
	return u.repo.Update(c, i)
}
func (u *QuestionUsecase) Delete(c context.Context, e, id, v uint64) error {
	return u.repo.Delete(c, e, id, v)
}
func (u *QuestionUsecase) Review(c context.Context, e, id, v uint64, action, reason string) (*Question, error) {
	if action != "approve" && action != "reject" {
		return nil, ErrQuestionInvalid
	}
	return u.repo.Review(c, e, id, v, action, reason)
}
func validateQuestion(i *Question) error {
	if i == nil || i.EnterpriseID == 0 || i.BrandID == 0 || i.KeywordID == 0 || strings.TrimSpace(i.Text) == "" || len([]rune(strings.TrimSpace(i.Region))) > 128 || !validQuestionStatus(i.Status) || !validQuestionIntent(i.Intent) || !validQuestionFunnel(i.FunnelStage) || (i.Source != QuestionSourceManual && i.Source != QuestionSourceDistilled) {
		return ErrQuestionInvalid
	}
	return nil
}
