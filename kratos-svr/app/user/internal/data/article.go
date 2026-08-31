package data

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/data/model"
)

type articleRepo struct {
	data    *Data
	storage *FileStorage
}

func NewArticleRepo(d *Data, storage *FileStorage) biz.ArticleRepo {
	return &articleRepo{data: d, storage: storage}
}
func (r *articleRepo) Create(c context.Context, i *biz.Article) (*biz.Article, error) {
	var p model.Article
	x := r.data.WithinTransaction(c, func(tx *gorm.DB) error {
		p = *articlePO(i)
		if e := tx.Create(&p).Error; e != nil {
			return e
		}
		v := model.ArticleVersion{ImmutableTenantModel: model.ImmutableTenantModel{EnterpriseID: i.EnterpriseID}, ArticleID: p.ID, VersionNumber: 1, Title: p.Title, Summary: p.Summary, ContentMarkdown: p.ContentMarkdown, ContentHTML: p.ContentHTML, ChangeSource: p.Source, OperatorType: "enterprise", OperatorID: i.EnterpriseID, ContentHash: contentHash(p.Title, p.ContentMarkdown, p.ContentHTML)}
		if e := tx.Create(&v).Error; e != nil {
			return e
		}
		return tx.Model(&p).Update("current_version_id", v.ID).Error
	})
	if x != nil {
		return nil, mapArticleError(x)
	}
	return r.Get(c, i.EnterpriseID, p.ID)
}
func (r *articleRepo) Get(c context.Context, e, id uint64) (*biz.Article, error) {
	var p model.Article
	if x := r.data.DB(c).Where("enterprise_id = ? AND id = ?", e, id).First(&p).Error; x != nil {
		return nil, mapArticleError(x)
	}
	article := articleDO(&p)
	if x := r.loadArticleImages(c, []*biz.Article{article}); x != nil {
		return nil, x
	}
	return article, nil
}
func (r *articleRepo) List(c context.Context, e uint64, o biz.ArticleListOptions) ([]*biz.Article, int64, error) {
	db := r.data.DB(c).Model(&model.Article{}).Where("enterprise_id = ?", e)
	if o.BrandID != 0 {
		db = db.Where("brand_id = ?", o.BrandID)
	}
	if o.Status != "" {
		db = db.Where("status = ?", o.Status)
	}
	if o.Keyword != "" {
		k := "%" + o.Keyword + "%"
		db = db.Where("title LIKE ? OR summary LIKE ?", k, k)
	}
	var total int64
	if x := db.Count(&total).Error; x != nil {
		return nil, 0, x
	}
	var rows []model.Article
	if x := db.Order("created_at DESC, id DESC").Offset(o.Offset).Limit(o.Limit).Find(&rows).Error; x != nil {
		return nil, 0, x
	}
	out := make([]*biz.Article, 0, len(rows))
	for j := range rows {
		out = append(out, articleDO(&rows[j]))
	}
	if x := r.loadArticleImages(c, out); x != nil {
		return nil, 0, x
	}
	return out, total, nil
}

type articleImageRow struct {
	ArticleID uint64
	ObjectKey string
	Placement int32
}

func (r *articleRepo) loadArticleImages(c context.Context, articles []*biz.Article) error {
	if len(articles) == 0 {
		return nil
	}
	byID := make(map[uint64]*biz.Article, len(articles))
	ids := make([]uint64, 0, len(articles))
	var enterpriseID uint64
	for _, article := range articles {
		if article == nil {
			continue
		}
		if enterpriseID == 0 {
			enterpriseID = article.EnterpriseID
		}
		byID[article.ID] = article
		ids = append(ids, article.ID)
	}
	if len(ids) == 0 {
		return nil
	}
	var rows []articleImageRow
	if x := r.data.DB(c).Table(model.TableArticleImages+" AS binding").
		Select("binding.article_id, image.object_key, binding.placement").
		Joins("JOIN "+model.TableGalleryImages+" AS image ON image.id = binding.gallery_image_id AND image.enterprise_id = binding.enterprise_id AND image.deleted_at IS NULL").
		Where("binding.enterprise_id = ? AND binding.article_id IN ? AND binding.deleted_at IS NULL", enterpriseID, ids).
		Order("binding.article_id ASC, binding.placement ASC, binding.sort_order ASC, binding.id ASC").
		Scan(&rows).Error; x != nil {
		return x
	}
	for _, row := range rows {
		article := byID[row.ArticleID]
		if article == nil {
			continue
		}
		url := r.storage.PublicURL(row.ObjectKey)
		if url == "" {
			continue
		}
		if row.Placement == 1 && article.CoverImageURL == "" {
			article.CoverImageURL = url
			continue
		}
		article.ImageURLs = append(article.ImageURLs, url)
	}
	return nil
}
func (r *articleRepo) Update(c context.Context, i *biz.Article, summary string) (*biz.Article, error) {
	x := r.data.WithinTransaction(c, func(tx *gorm.DB) error {
		var p model.Article
		if e := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("enterprise_id = ? AND id = ? AND version = ?", i.EnterpriseID, i.ID, i.Version).First(&p).Error; e != nil {
			return e
		}
		var count int64
		if e := tx.Model(&model.ArticleVersion{}).Where("enterprise_id = ? AND article_id = ?", i.EnterpriseID, i.ID).Count(&count).Error; e != nil {
			return e
		}
		v := model.ArticleVersion{ImmutableTenantModel: model.ImmutableTenantModel{EnterpriseID: i.EnterpriseID}, ArticleID: i.ID, VersionNumber: uint32(count + 1), Title: i.Title, Summary: i.Summary, ContentMarkdown: i.ContentMarkdown, ContentHTML: i.ContentHTML, ChangeSource: "edit", ChangeSummary: summary, OperatorType: "enterprise", OperatorID: i.EnterpriseID, ContentHash: contentHash(i.Title, i.ContentMarkdown, i.ContentHTML)}
		if e := tx.Create(&v).Error; e != nil {
			return e
		}
		res := tx.Model(&p).Updates(map[string]any{"brand_id": i.BrandID, "article_type_id": nullableID(i.ArticleTypeID), "title": i.Title, "summary": i.Summary, "content_markdown": i.ContentMarkdown, "content_html": i.ContentHTML, "current_version_id": v.ID, "quality_score": i.QualityScore, "quality_result_json": []byte(i.QualityResultJSON), "version": gorm.Expr("version + 1")})
		return res.Error
	})
	if x != nil {
		return nil, mapArticleError(x)
	}
	return r.Get(c, i.EnterpriseID, i.ID)
}
func (r *articleRepo) Delete(c context.Context, e, id, v uint64) error {
	res := r.data.DB(c).Where("enterprise_id = ? AND id = ? AND version = ?", e, id, v).Delete(&model.Article{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected != 1 {
		return biz.ErrArticleConflict
	}
	return nil
}
func (r *articleRepo) ChangeStatus(c context.Context, e, id, v uint64, action, reason string) (*biz.Article, error) {
	x := r.data.WithinTransaction(c, func(tx *gorm.DB) error {
		var p model.Article
		if z := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("enterprise_id = ? AND id = ? AND version = ?", e, id, v).First(&p).Error; z != nil {
			return z
		}
		next, ok := nextArticleStatus(p.Status, action)
		if !ok {
			return biz.ErrArticleState
		}
		res := tx.Model(&p).Updates(map[string]any{"status": next, "version": gorm.Expr("version + 1")})
		if res.Error != nil {
			return res.Error
		}
		review := model.ArticleReview{ImmutableTenantModel: model.ImmutableTenantModel{EnterpriseID: e}, ArticleID: id, Action: action, FromStatus: p.Status, ToStatus: next, ReviewerType: "enterprise", ReviewerID: e, Reason: reason}
		return tx.Create(&review).Error
	})
	if x != nil {
		return nil, mapArticleError(x)
	}
	return r.Get(c, e, id)
}
func (r *articleRepo) CreateSnapshot(c context.Context, e, id, v uint64, in biz.SnapshotInput) (*biz.ArticleSnapshot, error) {
	var s model.ArticleSnapshot
	x := r.data.WithinTransaction(c, func(tx *gorm.DB) error {
		var p model.Article
		if z := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("enterprise_id = ? AND id = ? AND version = ?", e, id, v).First(&p).Error; z != nil {
			return z
		}
	if p.Status != "normal" {
		return biz.ErrArticleState
	}
		if p.CurrentVersionID == nil {
			return biz.ErrArticleState
		}
		contentHTML := p.ContentHTML
		if strings.TrimSpace(contentHTML) == "" {
			contentHTML = renderMarkdownToHTML(p.ContentMarkdown)
		}
		s = model.ArticleSnapshot{ImmutableTenantModel: model.ImmutableTenantModel{EnterpriseID: e}, ArticleID: id, ArticleVersionID: *p.CurrentVersionID, Title: p.Title, ContentMarkdown: p.ContentMarkdown, ContentHTML: contentHTML, InputSnapshotJSON: []byte(in.InputSnapshotJSON), KnowledgeRefsJSON: []byte(in.KnowledgeRefsJSON), GalleryRefsJSON: []byte(in.GalleryRefsJSON), ContentHash: contentHash(p.Title, p.ContentMarkdown, contentHTML)}
		if in.ArticleTypeVersionID != 0 {
			s.ArticleTypeVersionID = &in.ArticleTypeVersionID
		}
		if in.PromptVersionID != 0 {
			s.PromptVersionID = &in.PromptVersionID
		}
		if in.WritingModelID != 0 {
			s.WritingModelID = &in.WritingModelID
		}
		if z := tx.Create(&s).Error; z != nil {
			return z
		}
		return tx.Model(&p).Updates(map[string]any{"latest_snapshot_id": s.ID, "version": gorm.Expr("version + 1")}).Error
	})
	if x != nil {
		return nil, mapArticleError(x)
	}
	return articleSnapshotDO(&s), nil
}
func nextArticleStatus(current, action string) (string, bool) {
	m := map[string]map[string]string{
		"draft":          {"approve": "normal", "disable": "disabled", "review": "pending_review"},
		"pending_review": {"approve": "normal", "disable": "disabled"},
		"normal":         {"disable": "disabled", "review": "pending_review"},
		"disabled":       {"review": "pending_review", "approve": "normal"},
	}
	n, ok := m[current][action]
	return n, ok
}
func contentHash(v ...string) string {
	h := sha256.New()
	for _, s := range v {
		_, _ = h.Write([]byte(s))
		_, _ = h.Write([]byte{0})
	}
	return hex.EncodeToString(h.Sum(nil))
}
func nullableID(v uint64) any {
	if v == 0 {
		return nil
	}
	return v
}
func articlePO(i *biz.Article) *model.Article {
	p := &model.Article{TenantModel: model.TenantModel{EnterpriseID: i.EnterpriseID}, BrandID: i.BrandID, Title: i.Title, Summary: i.Summary, ContentMarkdown: i.ContentMarkdown, ContentHTML: i.ContentHTML, Status: i.Status, Source: i.Source, QualityScore: i.QualityScore, QualityResultJSON: []byte(i.QualityResultJSON), Version: 1}
	if i.ArticleTypeID != 0 {
		p.ArticleTypeID = &i.ArticleTypeID
	}
	return p
}
func articleDO(i *model.Article) *biz.Article {
	o := &biz.Article{ID: i.ID, EnterpriseID: i.EnterpriseID, BrandID: i.BrandID, Title: i.Title, Summary: i.Summary, ContentMarkdown: i.ContentMarkdown, ContentHTML: i.ContentHTML, Status: i.Status, Source: i.Source, QualityScore: i.QualityScore, QualityResultJSON: string(i.QualityResultJSON), Version: i.Version, CreatedAt: i.CreatedAt, UpdatedAt: i.UpdatedAt, PublishedAt: i.PublishedAt}
	if i.ArticleTypeID != nil {
		o.ArticleTypeID = *i.ArticleTypeID
	}
	if i.CurrentVersionID != nil {
		o.CurrentVersionID = *i.CurrentVersionID
	}
	if i.LatestSnapshotID != nil {
		o.LatestSnapshotID = *i.LatestSnapshotID
	}
	return o
}
func articleSnapshotDO(i *model.ArticleSnapshot) *biz.ArticleSnapshot {
	o := &biz.ArticleSnapshot{ID: i.ID, EnterpriseID: i.EnterpriseID, ArticleID: i.ArticleID, ArticleVersionID: i.ArticleVersionID, Title: i.Title, ContentMarkdown: i.ContentMarkdown, ContentHTML: i.ContentHTML, InputSnapshotJSON: string(i.InputSnapshotJSON), KnowledgeRefsJSON: string(i.KnowledgeRefsJSON), GalleryRefsJSON: string(i.GalleryRefsJSON), ContentHash: i.ContentHash, CreatedAt: i.CreatedAt}
	if i.ArticleTypeVersionID != nil {
		o.ArticleTypeVersionID = *i.ArticleTypeVersionID
	}
	if i.PromptVersionID != nil {
		o.PromptVersionID = *i.PromptVersionID
	}
	if i.WritingModelID != nil {
		o.WritingModelID = *i.WritingModelID
	}
	return o
}
func mapArticleError(e error) error {
	if errors.Is(e, gorm.ErrRecordNotFound) {
		return biz.ErrArticleNotFound
	}
	if errors.Is(e, gorm.ErrDuplicatedKey) {
		return biz.ErrArticleConflict
	}
	return e
}
