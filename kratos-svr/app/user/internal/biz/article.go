package biz

import (
	"context"
	"encoding/json"
	"github.com/go-kratos/kratos/v3/errors"
	"strings"
	"time"
)

var (
	ErrArticleNotFound = errors.NotFound("ARTICLE_NOT_FOUND", "article not found")
	ErrArticleInvalid  = errors.BadRequest("ARTICLE_INVALID", "invalid article")
	ErrArticleConflict = errors.Conflict("ARTICLE_CONFLICT", "article version conflict")
	ErrArticleState    = errors.Conflict("ARTICLE_STATE_INVALID", "article state transition is invalid")
)

type Article struct {
	ID, EnterpriseID, BrandID, ArticleTypeID, CurrentVersionID, LatestSnapshotID    uint64
	Title, Summary, ContentMarkdown, ContentHTML, Status, Source, QualityResultJSON string
	CoverImageURL                                                                   string
	ImageURLs                                                                       []string
	QualityScore                                                                    float64
	Version                                                                         uint64
	CreatedAt, UpdatedAt                                                            time.Time
	PublishedAt                                                                     *time.Time
}
type ArticleSnapshot struct {
	ID, EnterpriseID, ArticleID, ArticleVersionID, ArticleTypeVersionID, PromptVersionID, WritingModelID    uint64
	Title, ContentMarkdown, ContentHTML, InputSnapshotJSON, KnowledgeRefsJSON, GalleryRefsJSON, ContentHash string
	CreatedAt                                                                                               time.Time
}
type ArticleListOptions struct {
	Offset, Limit   int
	BrandID         uint64
	Status, Keyword string
}
type SnapshotInput struct {
	ArticleTypeVersionID, PromptVersionID, WritingModelID uint64
	InputSnapshotJSON, KnowledgeRefsJSON, GalleryRefsJSON string
}
type ArticleRepo interface {
	Create(context.Context, *Article) (*Article, error)
	Get(context.Context, uint64, uint64) (*Article, error)
	List(context.Context, uint64, ArticleListOptions) ([]*Article, int64, error)
	Update(context.Context, *Article, string) (*Article, error)
	Delete(context.Context, uint64, uint64, uint64) error
	ChangeStatus(context.Context, uint64, uint64, uint64, string, string) (*Article, error)
	CreateSnapshot(context.Context, uint64, uint64, uint64, SnapshotInput) (*ArticleSnapshot, error)
}
type ArticleUsecase struct{ repo ArticleRepo }

func NewArticleUsecase(r ArticleRepo) *ArticleUsecase { return &ArticleUsecase{repo: r} }
func (u *ArticleUsecase) Create(c context.Context, i *Article) (*Article, error) {
	if x := validateArticle(i); x != nil {
		return nil, x
	}
	i.Status = "pending_review"
	if i.Source == "" {
		i.Source = "manual"
	}
	return u.repo.Create(c, i)
}
func (u *ArticleUsecase) Get(c context.Context, e, id uint64) (*Article, error) {
	return u.repo.Get(c, e, id)
}
func (u *ArticleUsecase) List(c context.Context, e uint64, o ArticleListOptions) ([]*Article, int64, error) {
	return u.repo.List(c, e, o)
}
func (u *ArticleUsecase) Update(c context.Context, i *Article, summary string) (*Article, error) {
	if i == nil || i.ID == 0 || i.Version == 0 {
		return nil, ErrArticleInvalid
	}
	if x := validateArticle(i); x != nil {
		return nil, x
	}
	current, x := u.repo.Get(c, i.EnterpriseID, i.ID)
	if x != nil {
		return nil, x
	}
	if current.Status == "disabled" {
		return nil, ErrArticleState
	}
	return u.repo.Update(c, i, summary)
}
func (u *ArticleUsecase) Delete(c context.Context, e, id, v uint64) error {
	return u.repo.Delete(c, e, id, v)
}
func (u *ArticleUsecase) ChangeStatus(c context.Context, e, id, v uint64, action, reason string) (*Article, error) {
	if !map[string]bool{"approve": true, "disable": true, "review": true}[action] {
		return nil, ErrArticleInvalid
	}
	return u.repo.ChangeStatus(c, e, id, v, action, reason)
}
func (u *ArticleUsecase) CreateSnapshot(c context.Context, e, id, v uint64, in SnapshotInput) (*ArticleSnapshot, error) {
	if !jsonOrEmpty(in.InputSnapshotJSON) || !jsonOrEmpty(in.KnowledgeRefsJSON) || !jsonOrEmpty(in.GalleryRefsJSON) {
		return nil, ErrArticleInvalid
	}
	return u.repo.CreateSnapshot(c, e, id, v, in)
}
func validateArticle(i *Article) error {
	if i == nil || i.EnterpriseID == 0 || i.BrandID == 0 || strings.TrimSpace(i.Title) == "" || (i.QualityResultJSON != "" && !json.Valid([]byte(i.QualityResultJSON))) {
		return ErrArticleInvalid
	}
	return nil
}
func jsonOrEmpty(v string) bool { return v == "" || json.Valid([]byte(v)) }
