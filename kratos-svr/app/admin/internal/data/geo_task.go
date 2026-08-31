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

type adminGeoTaskRepo struct{ data *Data }

func NewAdminGeoTaskRepo(data *Data) biz.AdminGeoTaskRepo { return &adminGeoTaskRepo{data: data} }
func (r *adminGeoTaskRepo) List(ctx context.Context, opts biz.AdminGeoTaskListOptions) ([]*biz.AdminGeoTask, int64, error) {
	db := r.data.DB(ctx).Model(&model.GEOTask{})
	if opts.EnterpriseID != 0 {
		db = db.Where("enterprise_id = ?", opts.EnterpriseID)
	}
	if opts.InclusionSiteID != 0 {
		db = db.Where("inclusion_site_id = ?", opts.InclusionSiteID)
	}
	if opts.Status != "" {
		db = db.Where("status = ?", opts.Status)
	}
	if opts.ErrorCategory != "" {
		db = db.Where("error_category = ?", opts.ErrorCategory)
	}
	if opts.Keyword != "" {
		k := "%" + opts.Keyword + "%"
		db = db.Where("model_entry LIKE ? OR error_message LIKE ?", k, k)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	// 使用子查询关联最新 AnswerSnapshot 的 session_ref 和 analysis_result 的 brand_mentioned，避免 N+1 查询
	var rows []struct {
		model.GEOTask
		SessionRef     string `gorm:"column:session_ref"`
		BrandMentioned bool   `gorm:"column:brand_mentioned"`
	}
	if err := db.
		Select("geo_tasks.*, " +
			"(SELECT session_ref FROM " + model.TableAnswerSnapshots + " WHERE geo_task_id = geo_tasks.id ORDER BY id DESC LIMIT 1) AS session_ref, " +
			"(SELECT ar.brand_mentioned FROM " + model.TableAnalysisResults + " ar " +
			"INNER JOIN " + model.TableAnswerSnapshots + " s ON s.id = ar.answer_snapshot_id " +
			"WHERE s.geo_task_id = geo_tasks.id ORDER BY ar.id DESC LIMIT 1) AS brand_mentioned").
		Order("id DESC").Offset(opts.Offset).Limit(opts.Limit).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	records := make([]model.GEOTask, 0, len(rows))
	extra := make(map[uint64]struct {
		SessionRef     string
		BrandMentioned bool
	}, len(rows))
	for i := range rows {
		records = append(records, rows[i].GEOTask)
		extra[rows[i].GEOTask.ID] = struct {
			SessionRef     string
			BrandMentioned bool
		}{SessionRef: rows[i].SessionRef, BrandMentioned: rows[i].BrandMentioned}
	}
	items, err := r.hydrate(ctx, records)
	if err != nil {
		return nil, 0, err
	}
	for i := range items {
		if e, ok := extra[items[i].ID]; ok {
			items[i].BrandMentioned = e.BrandMentioned
			items[i].SessionRef = e.SessionRef
		}
	}
	return items, total, nil
}
func (r *adminGeoTaskRepo) Get(ctx context.Context, id uint64) (*biz.AdminGeoTaskDetail, error) {
	var record model.GEOTask
	if err := r.data.DB(ctx).First(&record, id).Error; err != nil {
		return nil, mapAdminGeoTaskError(err)
	}
	items, err := r.hydrate(ctx, []model.GEOTask{record})
	if err != nil {
		return nil, err
	}
	d := &biz.AdminGeoTaskDetail{Task: items[0], Citations: []*biz.AdminCitation{}, Mentions: []*biz.AdminMention{}, Reviews: []*biz.AdminManualReview{}}
	var answer model.AnswerSnapshot
	err = r.data.DB(ctx).Where("geo_task_id = ?", id).Order("id DESC").First(&answer).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return d, nil
	}
	if err != nil {
		return nil, err
	}
	d.Answer = &biz.AdminAnswerSnapshot{ID: answer.ID, AttemptID: answer.AttemptID, ModelEntry: answer.ModelEntry, QuestionText: answer.QuestionText, AnswerText: answer.AnswerText, AnswerStatus: answer.AnswerStatus, ScreenshotKey: answer.ScreenshotKey, EvidenceJSON: string(answer.EvidenceJSON), SessionRef: answer.SessionRef, ObservedAt: answer.ObservedAt, ClientVersion: answer.ClientVersion}
	var citations []model.Citation
	if err := r.data.DB(ctx).Where("answer_snapshot_id = ?", answer.ID).Order("position ASC").Find(&citations).Error; err != nil {
		return nil, err
	}
	for i := range citations {
		v := &citations[i]
		d.Citations = append(d.Citations, &biz.AdminCitation{ID: v.ID, URL: v.URL, Domain: v.Domain, Title: v.Title, Position: v.Position, IsEnterpriseSource: v.IsEnterpriseSource, ArticleID: v.ArticleID, MetadataJSON: string(v.MetadataJSON)})
	}
	var mentions []model.Mention
	if err := r.data.DB(ctx).Where("answer_snapshot_id = ?", answer.ID).Order("position ASC").Find(&mentions).Error; err != nil {
		return nil, err
	}
	for i := range mentions {
		v := &mentions[i]
		d.Mentions = append(d.Mentions, &biz.AdminMention{ID: v.ID, EntityType: v.EntityType, EntityID: v.EntityID, Text: v.Text, Position: v.Position, Sentiment: v.Sentiment, Confidence: v.Confidence})
	}
	var analysis model.AnalysisResult
	err = r.data.DB(ctx).Where("answer_snapshot_id = ?", answer.ID).Order("analysis_version DESC").First(&analysis).Error
	if err == nil {
		d.Analysis = &biz.AdminAnalysisResult{ID: analysis.ID, AnalysisVersion: analysis.AnalysisVersion, RuleVersion: analysis.RuleVersion, Status: analysis.Status, BrandMentioned: analysis.BrandMentioned, EnterpriseCited: analysis.EnterpriseCited, VisibilityScore: analysis.VisibilityScore, AccuracyScore: analysis.AccuracyScore, Confidence: analysis.Confidence, ResultJSON: string(analysis.ResultJSON)}
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	var reviews []model.ManualReview
	if err := r.data.DB(ctx).Where("answer_snapshot_id = ?", answer.ID).Order("id DESC").Find(&reviews).Error; err != nil {
		return nil, err
	}
	for i := range reviews {
		v := &reviews[i]
		d.Reviews = append(d.Reviews, &biz.AdminManualReview{ID: v.ID, AnswerSnapshotID: v.AnswerSnapshotID, AnalysisResultID: v.AnalysisResultID, ReviewerID: v.ReviewerID, BeforeJSON: string(v.BeforeJSON), AfterJSON: string(v.AfterJSON), Reason: v.Reason, CreatedAt: v.CreatedAt})
	}
	return d, nil
}
func (r *adminGeoTaskRepo) ChangeStatus(ctx context.Context, cmd biz.AdminGeoTaskAction) (*biz.AdminGeoTaskDetail, error) {
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var before model.GEOTask
		if err := tx.First(&before, cmd.ID).Error; err != nil {
			return err
		}
		updates := map[string]any{"version": gorm.Expr("version + 1")}
		if cmd.Action == "retry" {
			if before.Status != "failed" && before.Status != "cancelled" {
				return biz.ErrGeoTaskInvalid
			}
			updates["status"] = "queued"
			updates["scheduled_at"] = time.Now().UTC()
			updates["current_lease_id"] = nil
			updates["error_category"] = ""
			updates["error_code"] = ""
			updates["error_message"] = ""
			updates["completed_at"] = nil
		} else {
			if before.Status == "succeeded" || before.Status == "cancelled" {
				return biz.ErrGeoTaskInvalid
			}
			now := time.Now().UTC()
			updates["status"] = "cancelled"
			updates["completed_at"] = now
			updates["current_lease_id"] = nil
			if before.CurrentLeaseID != nil {
				if err := tx.Model(&model.TaskLease{}).Where("id = ? AND status = ?", *before.CurrentLeaseID, "active").Updates(map[string]any{"status": "released", "released_at": now, "release_reason": "admin_cancel"}).Error; err != nil {
					return err
				}
			}
		}
		result := tx.Model(&model.GEOTask{}).Where("id = ? AND version = ?", cmd.ID, cmd.Version).Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return biz.ErrGeoTaskConflict
		}
		return writeAdminAudit(ctx, tx, cmd.OperatorID, "geo_task."+cmd.Action, "geo_task", strconv.FormatUint(cmd.ID, 10), "success", cmd.Reason, before, updates)
	})
	if err != nil {
		return nil, mapAdminGeoTaskError(err)
	}
	return r.Get(ctx, cmd.ID)
}
func (r *adminGeoTaskRepo) CreateManualReview(ctx context.Context, cmd biz.AdminManualReviewCommand) (*biz.AdminGeoTaskDetail, error) {
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var task model.GEOTask
		if err := tx.First(&task, cmd.TaskID).Error; err != nil {
			return err
		}
		var answer model.AnswerSnapshot
		if err := tx.Where("id = ? AND geo_task_id = ?", cmd.AnswerSnapshotID, cmd.TaskID).First(&answer).Error; err != nil {
			return err
		}
		if cmd.AnalysisResultID != nil {
			var count int64
			if err := tx.Model(&model.AnalysisResult{}).Where("id = ? AND answer_snapshot_id = ?", *cmd.AnalysisResultID, answer.ID).Count(&count).Error; err != nil {
				return err
			}
			if count != 1 {
				return biz.ErrGeoTaskInvalid
			}
		}
		review := &model.ManualReview{ImmutableTenantModel: model.ImmutableTenantModel{EnterpriseID: task.EnterpriseID}, AnswerSnapshotID: answer.ID, AnalysisResultID: cmd.AnalysisResultID, ReviewerID: cmd.OperatorID, BeforeJSON: jsonBytes(cmd.BeforeJSON), AfterJSON: jsonBytes(cmd.AfterJSON), Reason: cmd.Reason}
		if err := tx.Create(review).Error; err != nil {
			return err
		}
		return writeAdminAudit(ctx, tx, cmd.OperatorID, "geo_task.manual_review.create", "geo_task", strconv.FormatUint(cmd.TaskID, 10), "success", cmd.Reason, nil, review)
	})
	if err != nil {
		return nil, mapAdminGeoTaskError(err)
	}
	return r.Get(ctx, cmd.TaskID)
}
func (r *adminGeoTaskRepo) hydrate(ctx context.Context, records []model.GEOTask) ([]*biz.AdminGeoTask, error) {
	items := make([]*biz.AdminGeoTask, 0, len(records))
	if len(records) == 0 {
		return items, nil
	}
	eids, bids, qids, sids, pids := []uint64{}, []uint64{}, []uint64{}, []uint64{}, []uint64{}
	for i := range records {
		v := &records[i]
		eids = append(eids, v.EnterpriseID)
		bids = append(bids, v.BrandID)
		qids = append(qids, v.QuestionID)
		sids = append(sids, v.InclusionSiteID)
		if v.MonitorPlanID != nil {
			pids = append(pids, *v.MonitorPlanID)
		}
	}
	en, bn, qn, sn, pn := map[uint64]string{}, map[uint64]string{}, map[uint64]string{}, map[uint64]string{}, map[uint64]string{}
	var es []model.Enterprise
	if err := r.data.DB(ctx).Where("id IN ?", eids).Find(&es).Error; err != nil {
		return nil, err
	}
	for _, v := range es {
		en[v.ID] = v.Name
	}
	var bs []model.Brand
	if err := r.data.DB(ctx).Where("id IN ?", bids).Find(&bs).Error; err != nil {
		return nil, err
	}
	for _, v := range bs {
		bn[v.ID] = v.Name
	}
	var qs []model.Question
	if err := r.data.DB(ctx).Where("id IN ?", qids).Find(&qs).Error; err != nil {
		return nil, err
	}
	for _, v := range qs {
		qn[v.ID] = v.Text
	}
	var ss []model.InclusionSite
	if err := r.data.DB(ctx).Where("id IN ?", sids).Find(&ss).Error; err != nil {
		return nil, err
	}
	for _, v := range ss {
		sn[v.ID] = v.Name
	}
	if len(pids) > 0 {
		var ps []model.MonitorPlan
		if err := r.data.DB(ctx).Where("id IN ?", pids).Find(&ps).Error; err != nil {
			return nil, err
		}
		for _, v := range ps {
			pn[v.ID] = v.Name
		}
	}
	for i := range records {
		v := &records[i]
		planName := ""
		if v.MonitorPlanID != nil {
			planName = pn[*v.MonitorPlanID]
		}
		items = append(items, &biz.AdminGeoTask{ID: v.ID, EnterpriseID: v.EnterpriseID, EnterpriseName: en[v.EnterpriseID], MonitorPlanID: v.MonitorPlanID, MonitorPlanName: planName, BrandID: v.BrandID, BrandName: bn[v.BrandID], QuestionID: v.QuestionID, QuestionText: qn[v.QuestionID], InclusionSiteID: v.InclusionSiteID, InclusionSiteName: sn[v.InclusionSiteID], PlatformAccountID: v.PlatformAccountID, ModelEntry: v.ModelEntry, Locale: v.Locale, Region: v.Region, Status: v.Status, Priority: v.Priority, TerminalType: v.TerminalType, ScheduledAt: v.ScheduledAt, AttemptCount: v.AttemptCount, MaxAttempts: v.MaxAttempts, ErrorCategory: v.ErrorCategory, ErrorCode: v.ErrorCode, ErrorMessage: v.ErrorMessage, CompletedAt: v.CompletedAt, Version: v.Version, CreatedAt: v.CreatedAt, UpdatedAt: v.UpdatedAt})
	}
	return items, nil
}
func mapAdminGeoTaskError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return biz.ErrGeoTaskNotFound
	}
	return err
}
