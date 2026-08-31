package biz

import (
	"context"
	"strings"
	"time"

	"github.com/go-kratos/kratos/v3/errors"
)

var (
	ErrArticleNotFound = errors.NotFound("ARTICLE_NOT_FOUND", "article not found")
	ErrArticleInvalid  = errors.BadRequest("ARTICLE_INVALID", "invalid article operation")
	ErrArticleConflict = errors.Conflict("ARTICLE_CONFLICT", "article data has changed")
)

type AdminArticle struct {
	ID, EnterpriseID, BrandID          uint64
	EnterpriseName, BrandName          string
	ArticleTypeID                      *uint64
	ArticleTypeName                    string
	Title, Summary                     string
	ContentMarkdown, ContentHTML       string
	Status, Source, QualityResultJSON  string
	CurrentVersionID, LatestSnapshotID *uint64
	QualityScore                       float64
	PublishedAt                        *time.Time
	Version                            uint64
	CreatedAt, UpdatedAt               time.Time
}

type AdminArticleVersion struct {
	ID                                                        uint64
	VersionNumber                                             uint32
	Title, Summary, ChangeSource, ChangeSummary, OperatorType string
	OperatorID                                                uint64
	CreatedAt                                                 time.Time
}

type AdminArticleReview struct {
	ID                                         uint64
	Action, FromStatus, ToStatus, ReviewerType string
	ReviewerID                                 uint64
	Reason                                     string
	CreatedAt                                  time.Time
}

type AdminArticleDetail struct {
	Article  *AdminArticle
	Versions []*AdminArticleVersion
	Reviews  []*AdminArticleReview
}

type AdminArticleListOptions struct {
	Offset, Limit           int
	EnterpriseID, BrandID   uint64
	Status, Source, Keyword string
	MinQualityScore         *float64
}

type AdminArticleAction struct {
	ID, Version, OperatorID uint64
	Action, Reason          string
}

type AdminArticleRepo interface {
	List(context.Context, AdminArticleListOptions) ([]*AdminArticle, int64, error)
	Get(context.Context, uint64) (*AdminArticleDetail, error)
	Review(context.Context, AdminArticleAction) (*AdminArticleDetail, error)
	Archive(context.Context, AdminArticleAction) (*AdminArticleDetail, error)
}

type AdminArticleUsecase struct{ repo AdminArticleRepo }

func NewAdminArticleUsecase(repo AdminArticleRepo) *AdminArticleUsecase {
	return &AdminArticleUsecase{repo: repo}
}
func (uc *AdminArticleUsecase) List(ctx context.Context, opts AdminArticleListOptions) ([]*AdminArticle, int64, error) {
	return uc.repo.List(ctx, opts)
}
func (uc *AdminArticleUsecase) Get(ctx context.Context, id uint64) (*AdminArticleDetail, error) {
	if id == 0 {
		return nil, ErrArticleInvalid
	}
	return uc.repo.Get(ctx, id)
}
func (uc *AdminArticleUsecase) Review(ctx context.Context, cmd AdminArticleAction) (*AdminArticleDetail, error) {
	if cmd.ID == 0 || cmd.Version == 0 || cmd.OperatorID == 0 || strings.TrimSpace(cmd.Reason) == "" {
		return nil, ErrArticleInvalid
	}
	if cmd.Action != "approve" && cmd.Action != "disable" && cmd.Action != "review" {
		return nil, ErrArticleInvalid
	}
	return uc.repo.Review(ctx, cmd)
}
func (uc *AdminArticleUsecase) Archive(ctx context.Context, cmd AdminArticleAction) (*AdminArticleDetail, error) {
	if cmd.ID == 0 || cmd.Version == 0 || cmd.OperatorID == 0 || strings.TrimSpace(cmd.Reason) == "" {
		return nil, ErrArticleInvalid
	}
	cmd.Action = "archive"
	return uc.repo.Archive(ctx, cmd)
}
