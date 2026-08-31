package data

import (
	"context"
	"errors"
	"strconv"
	"time"

	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/data/model"

	"gorm.io/gorm"
)

type adminArticleRepo struct{ data *Data }

func NewAdminArticleRepo(data *Data) biz.AdminArticleRepo { return &adminArticleRepo{data: data} }

func (r *adminArticleRepo) List(ctx context.Context, opts biz.AdminArticleListOptions) ([]*biz.AdminArticle, int64, error) {
	db := r.data.DB(ctx).Model(&model.Article{})
	if opts.EnterpriseID != 0 {
		db = db.Where("enterprise_id = ?", opts.EnterpriseID)
	}
	if opts.BrandID != 0 {
		db = db.Where("brand_id = ?", opts.BrandID)
	}
	if opts.Status != "" {
		db = db.Where("status = ?", opts.Status)
	}
	if opts.Source != "" {
		db = db.Where("source = ?", opts.Source)
	}
	if opts.Keyword != "" {
		keyword := "%" + opts.Keyword + "%"
		db = db.Where("title LIKE ? OR summary LIKE ?", keyword, keyword)
	}
	if opts.MinQualityScore != nil {
		db = db.Where("quality_score >= ?", *opts.MinQualityScore)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var records []model.Article
	if err := db.Order("id DESC").Offset(opts.Offset).Limit(opts.Limit).Find(&records).Error; err != nil {
		return nil, 0, err
	}
	items, err := r.hydrate(ctx, records)
	return items, total, err
}

func (r *adminArticleRepo) Get(ctx context.Context, id uint64) (*biz.AdminArticleDetail, error) {
	var record model.Article
	if err := r.data.DB(ctx).First(&record, id).Error; err != nil {
		return nil, mapAdminArticleError(err)
	}
	items, err := r.hydrate(ctx, []model.Article{record})
	if err != nil {
		return nil, err
	}
	detail := &biz.AdminArticleDetail{Article: items[0], Versions: []*biz.AdminArticleVersion{}, Reviews: []*biz.AdminArticleReview{}}
	var versions []model.ArticleVersion
	if err := r.data.DB(ctx).Where("article_id = ?", id).Order("version_number DESC").Find(&versions).Error; err != nil {
		return nil, err
	}
	for i := range versions {
		v := &versions[i]
		detail.Versions = append(detail.Versions, &biz.AdminArticleVersion{ID: v.ID, VersionNumber: v.VersionNumber, Title: v.Title, Summary: v.Summary, ChangeSource: v.ChangeSource, ChangeSummary: v.ChangeSummary, OperatorType: v.OperatorType, OperatorID: v.OperatorID, CreatedAt: v.CreatedAt})
	}
	var reviews []model.ArticleReview
	if err := r.data.DB(ctx).Where("article_id = ?", id).Order("id DESC").Find(&reviews).Error; err != nil {
		return nil, err
	}
	for i := range reviews {
		v := &reviews[i]
		detail.Reviews = append(detail.Reviews, &biz.AdminArticleReview{ID: v.ID, Action: v.Action, FromStatus: v.FromStatus, ToStatus: v.ToStatus, ReviewerType: v.ReviewerType, ReviewerID: v.ReviewerID, Reason: v.Reason, CreatedAt: v.CreatedAt})
	}
	return detail, nil
}

func (r *adminArticleRepo) Review(ctx context.Context, cmd biz.AdminArticleAction) (*biz.AdminArticleDetail, error) {
	target := map[string]string{"approve": "normal", "disable": "disabled", "review": "pending_review"}[cmd.Action]
	if target == "" {
		return nil, biz.ErrArticleInvalid
	}
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var before model.Article
		if err := tx.First(&before, cmd.ID).Error; err != nil {
			return err
		}
		result := tx.Model(&model.Article{}).Where("id = ? AND version = ?", cmd.ID, cmd.Version).Updates(map[string]any{"status": target, "version": gorm.Expr("version + 1")})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return biz.ErrArticleConflict
		}
		review := &model.ArticleReview{ImmutableTenantModel: model.ImmutableTenantModel{EnterpriseID: before.EnterpriseID}, ArticleID: before.ID, Action: cmd.Action, FromStatus: before.Status, ToStatus: target, ReviewerType: "admin", ReviewerID: cmd.OperatorID, Reason: cmd.Reason}
		if err := tx.Create(review).Error; err != nil {
			return err
		}
		return writeAdminAudit(ctx, tx, cmd.OperatorID, "article.review."+cmd.Action, "article", strconv.FormatUint(cmd.ID, 10), "success", cmd.Reason, before, map[string]any{"status": target})
	})
	if err != nil {
		return nil, mapAdminArticleError(err)
	}
	return r.Get(ctx, cmd.ID)
}

func (r *adminArticleRepo) Archive(ctx context.Context, cmd biz.AdminArticleAction) (*biz.AdminArticleDetail, error) {
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var before model.Article
		if err := tx.First(&before, cmd.ID).Error; err != nil {
			return err
		}
		if before.Status == "archived" {
			return biz.ErrArticleInvalid
		}
		result := tx.Model(&model.Article{}).Where("id = ? AND version = ?", cmd.ID, cmd.Version).Updates(map[string]any{"status": "archived", "version": gorm.Expr("version + 1")})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return biz.ErrArticleConflict
		}
		var snapshotIDs []uint64
		if err := tx.Model(&model.ArticleSnapshot{}).Where("article_id = ?", before.ID).Pluck("id", &snapshotIDs).Error; err != nil {
			return err
		}
		if len(snapshotIDs) > 0 {
			if err := tx.Model(&model.PublishTask{}).Where("enterprise_id = ? AND article_snapshot_id IN ? AND status IN ?", before.EnterpriseID, snapshotIDs, []string{"queued", "retry_wait"}).Updates(map[string]any{"status": "cancelled", "completed_at": time.Now().UTC(), "version": gorm.Expr("version + 1")}).Error; err != nil {
				return err
			}
		}
		return writeAdminAudit(ctx, tx, cmd.OperatorID, "article.archive", "article", strconv.FormatUint(cmd.ID, 10), "success", cmd.Reason, before, map[string]any{"status": "archived"})
	})
	if err != nil {
		return nil, mapAdminArticleError(err)
	}
	return r.Get(ctx, cmd.ID)
}

func (r *adminArticleRepo) hydrate(ctx context.Context, records []model.Article) ([]*biz.AdminArticle, error) {
	items := make([]*biz.AdminArticle, 0, len(records))
	if len(records) == 0 {
		return items, nil
	}
	enterpriseIDs, brandIDs, typeIDs := []uint64{}, []uint64{}, []uint64{}
	for i := range records {
		enterpriseIDs = append(enterpriseIDs, records[i].EnterpriseID)
		brandIDs = append(brandIDs, records[i].BrandID)
		if records[i].ArticleTypeID != nil {
			typeIDs = append(typeIDs, *records[i].ArticleTypeID)
		}
	}
	enterpriseNames, brandNames, typeNames := map[uint64]string{}, map[uint64]string{}, map[uint64]string{}
	var enterprises []model.Enterprise
	if err := r.data.DB(ctx).Where("id IN ?", enterpriseIDs).Find(&enterprises).Error; err != nil {
		return nil, err
	}
	for i := range enterprises {
		enterpriseNames[enterprises[i].ID] = enterprises[i].Name
	}
	var brands []model.Brand
	if err := r.data.DB(ctx).Where("id IN ?", brandIDs).Find(&brands).Error; err != nil {
		return nil, err
	}
	for i := range brands {
		brandNames[brands[i].ID] = brands[i].Name
	}
	if len(typeIDs) > 0 {
		var types []model.ArticleType
		if err := r.data.DB(ctx).Where("id IN ?", typeIDs).Find(&types).Error; err != nil {
			return nil, err
		}
		for i := range types {
			typeNames[types[i].ID] = types[i].Name
		}
	}
	for i := range records {
		v := &records[i]
		typeName := ""
		if v.ArticleTypeID != nil {
			typeName = typeNames[*v.ArticleTypeID]
		}
		items = append(items, &biz.AdminArticle{ID: v.ID, EnterpriseID: v.EnterpriseID, EnterpriseName: enterpriseNames[v.EnterpriseID], BrandID: v.BrandID, BrandName: brandNames[v.BrandID], ArticleTypeID: v.ArticleTypeID, ArticleTypeName: typeName, Title: v.Title, Summary: v.Summary, ContentMarkdown: v.ContentMarkdown, ContentHTML: v.ContentHTML, Status: v.Status, Source: v.Source, CurrentVersionID: v.CurrentVersionID, LatestSnapshotID: v.LatestSnapshotID, QualityScore: v.QualityScore, QualityResultJSON: string(v.QualityResultJSON), PublishedAt: v.PublishedAt, Version: v.Version, CreatedAt: v.CreatedAt, UpdatedAt: v.UpdatedAt})
	}
	return items, nil
}

func mapAdminArticleError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return biz.ErrArticleNotFound
	}
	return err
}
