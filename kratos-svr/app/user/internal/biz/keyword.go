package biz

import (
	"context"
	"encoding/json"
	"github.com/go-kratos/kratos/v3/errors"
	"strings"
	"time"
)

var (
	ErrKeywordNotFound = errors.NotFound("KEYWORD_NOT_FOUND", "keyword not found")
	ErrKeywordInvalid  = errors.BadRequest("KEYWORD_INVALID", "invalid keyword")
	ErrKeywordConflict = errors.Conflict("KEYWORD_CONFLICT", "keyword version conflict")
)

type Keyword struct {
	ID, EnterpriseID, BrandID                      uint64
	Text, Region, TagsJSON, Status, Source         string
	Priority                                       int32
	RequestedQuestionCount, DistilledQuestionCount uint32
	DistillationStatus                             int32
	LastDistillationTaskID                         uint64
	DistillationError                              string
	Version                                        uint64
	CreatedAt, UpdatedAt                           time.Time
}
type KeywordListOptions struct {
	Offset, Limit   int
	BrandID         uint64
	Status, Keyword string
}
type KeywordRepo interface {
	Create(context.Context, *Keyword) (*Keyword, error)
	Get(context.Context, uint64, uint64) (*Keyword, error)
	List(context.Context, uint64, KeywordListOptions) ([]*Keyword, int64, error)
	Update(context.Context, *Keyword) (*Keyword, error)
	Delete(context.Context, uint64, uint64, uint64) error
	MarkDistillationFailed(context.Context, uint64, uint64, uint32, string) (*Keyword, error)
}
type KeywordUsecase struct{ repo KeywordRepo }

func NewKeywordUsecase(r KeywordRepo) *KeywordUsecase { return &KeywordUsecase{repo: r} }
func (u *KeywordUsecase) Create(c context.Context, i *Keyword) (*Keyword, error) {
	if x := validateKeyword(i); x != nil {
		return nil, x
	}
	if i.Status == "" {
		i.Status = "active"
	}
	if i.Source == "" {
		i.Source = "manual"
	}
	return u.repo.Create(c, i)
}
func (u *KeywordUsecase) Get(c context.Context, e, id uint64) (*Keyword, error) {
	return u.repo.Get(c, e, id)
}
func (u *KeywordUsecase) List(c context.Context, e uint64, o KeywordListOptions) ([]*Keyword, int64, error) {
	return u.repo.List(c, e, o)
}
func (u *KeywordUsecase) Update(c context.Context, i *Keyword) (*Keyword, error) {
	if i == nil || i.ID == 0 || i.Version == 0 {
		return nil, ErrKeywordInvalid
	}
	if x := validateKeyword(i); x != nil {
		return nil, x
	}
	return u.repo.Update(c, i)
}
func (u *KeywordUsecase) Delete(c context.Context, e, id, v uint64) error {
	return u.repo.Delete(c, e, id, v)
}
func (u *KeywordUsecase) MarkDistillationFailed(c context.Context, enterpriseID, id uint64, requestedCount uint32, message string) (*Keyword, error) {
	return u.repo.MarkDistillationFailed(c, enterpriseID, id, requestedCount, message)
}
func validateKeyword(i *Keyword) error {
	if i == nil || i.EnterpriseID == 0 || i.BrandID == 0 || strings.TrimSpace(i.Text) == "" || len([]rune(strings.TrimSpace(i.Region))) > 128 || (i.TagsJSON != "" && !json.Valid([]byte(i.TagsJSON))) {
		return ErrKeywordInvalid
	}
	return nil
}
