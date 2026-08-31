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

type adminPublishTaskRepo struct{ data *Data }

func NewAdminPublishTaskRepo(data *Data) biz.AdminPublishTaskRepo {
	return &adminPublishTaskRepo{data: data}
}

func (r *adminPublishTaskRepo) List(ctx context.Context, opts biz.AdminPublishTaskListOptions) ([]*biz.AdminPublishTask, int64, error) {
	db := r.data.DB(ctx).Model(&model.PublishTask{})
	if opts.EnterpriseID != 0 {
		db = db.Where("enterprise_id = ?", opts.EnterpriseID)
	}
	if opts.PublishChannelID != 0 {
		db = db.Where("publish_channel_id = ?", opts.PublishChannelID)
	}
	if opts.Status != "" {
		db = db.Where("status = ?", opts.Status)
	}
	if opts.ErrorCategory != "" {
		db = db.Where("error_category = ?", opts.ErrorCategory)
	}
	if opts.Keyword != "" {
		k := "%" + opts.Keyword + "%"
		db = db.Where("result_url LIKE ? OR platform_article_id LIKE ? OR error_message LIKE ?", k, k, k)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var records []model.PublishTask
	if err := db.Order("id DESC").Offset(opts.Offset).Limit(opts.Limit).Find(&records).Error; err != nil {
		return nil, 0, err
	}
	items, err := r.hydrate(ctx, records)
	return items, total, err
}
func (r *adminPublishTaskRepo) Get(ctx context.Context, id uint64) (*biz.AdminPublishTaskDetail, error) {
	var record model.PublishTask
	if err := r.data.DB(ctx).First(&record, id).Error; err != nil {
		return nil, mapAdminPublishTaskError(err)
	}
	items, err := r.hydrate(ctx, []model.PublishTask{record})
	if err != nil {
		return nil, err
	}
	d := &biz.AdminPublishTaskDetail{Task: items[0], Attempts: []*biz.AdminPublishAttempt{}}
	var attempts []model.PublishAttempt
	if err := r.data.DB(ctx).Where("publish_task_id = ?", id).Order("attempt_number DESC").Find(&attempts).Error; err != nil {
		return nil, err
	}
	for i := range attempts {
		v := &attempts[i]
		d.Attempts = append(d.Attempts, &biz.AdminPublishAttempt{ID: v.ID, AttemptNumber: v.AttemptNumber, WorkerNodeID: v.WorkerNodeID, LeaseID: v.LeaseID, Status: v.Status, StartedAt: v.StartedAt, FinishedAt: v.FinishedAt, DurationMS: v.DurationMS, ResultJSON: string(v.ResultJSON), EvidenceJSON: string(v.EvidenceJSON), ErrorCategory: v.ErrorCategory, ErrorCode: v.ErrorCode, ErrorMessage: v.ErrorMessage, ClientVersion: v.ClientVersion})
	}
	var receipt model.SubmissionReceipt
	err = r.data.DB(ctx).Where("publish_task_id = ?", id).Order("id DESC").First(&receipt).Error
	if err == nil {
		d.Receipt = receiptDO(&receipt)
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	return d, nil
}
func (r *adminPublishTaskRepo) ChangeStatus(ctx context.Context, cmd biz.AdminPublishTaskAction) (*biz.AdminPublishTaskDetail, error) {
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var before model.PublishTask
		if err := tx.First(&before, cmd.ID).Error; err != nil {
			return err
		}
		updates := map[string]any{"version": gorm.Expr("version + 1")}
		if cmd.Action == "retry" {
			if before.Status != "failed" && before.Status != "cancelled" {
				return biz.ErrPublishTaskInvalid
			}
			updates["status"] = "queued"
			updates["scheduled_at"] = time.Now().UTC()
			updates["next_retry_at"] = nil
			updates["current_lease_id"] = nil
			updates["error_category"] = ""
			updates["error_code"] = ""
			updates["error_message"] = ""
			updates["completed_at"] = nil
		} else {
			if before.Status == "succeeded" || before.Status == "cancelled" {
				return biz.ErrPublishTaskInvalid
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
		result := tx.Model(&model.PublishTask{}).Where("id = ? AND version = ?", cmd.ID, cmd.Version).Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return biz.ErrPublishTaskConflict
		}
		return writeAdminAudit(ctx, tx, cmd.OperatorID, "publish_task."+cmd.Action, "publish_task", strconv.FormatUint(cmd.ID, 10), "success", cmd.Reason, before, updates)
	})
	if err != nil {
		return nil, mapAdminPublishTaskError(err)
	}
	return r.Get(ctx, cmd.ID)
}
func (r *adminPublishTaskRepo) SaveReceipt(ctx context.Context, cmd biz.AdminReceiptCommand) (*biz.AdminPublishTaskDetail, error) {
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var task model.PublishTask
		if err := tx.First(&task, cmd.TaskID).Error; err != nil {
			return err
		}
		var before model.SubmissionReceipt
		err := tx.Where("publish_task_id = ?", cmd.TaskID).Order("id DESC").First(&before).Error
		values := receiptPO(cmd.Receipt)
		values.EnterpriseID = task.EnterpriseID
		values.PublishTaskID = task.ID
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if err := tx.Create(values).Error; err != nil {
				return err
			}
		} else if err != nil {
			return err
		} else {
			values.ID = before.ID
			if err := tx.Model(&before).Updates(map[string]any{"receipt_type": values.ReceiptType, "receipt_code": values.ReceiptCode, "status": values.Status, "submitted_at": values.SubmittedAt, "expected_at": values.ExpectedAt, "published_at": values.PublishedAt, "published_url": values.PublishedURL, "cost_minor_units": values.CostMinorUnits, "currency": values.Currency, "follow_up_json": values.FollowUpJSON}).Error; err != nil {
				return err
			}
		}
		return writeAdminAudit(ctx, tx, cmd.OperatorID, "publish_task.receipt.save", "publish_task", strconv.FormatUint(cmd.TaskID, 10), "success", cmd.Reason, before, values)
	})
	if err != nil {
		return nil, mapAdminPublishTaskError(err)
	}
	return r.Get(ctx, cmd.TaskID)
}
func (r *adminPublishTaskRepo) hydrate(ctx context.Context, records []model.PublishTask) ([]*biz.AdminPublishTask, error) {
	items := make([]*biz.AdminPublishTask, 0, len(records))
	if len(records) == 0 {
		return items, nil
	}
	eids, pids, sids, cids, tids := []uint64{}, []uint64{}, []uint64{}, []uint64{}, []uint64{}
	for i := range records {
		v := &records[i]
		eids = append(eids, v.EnterpriseID)
		pids = append(pids, v.PublishPlanID)
		sids = append(sids, v.ArticleSnapshotID)
		cids = append(cids, v.PublishChannelID)
		if v.PublishTargetID != nil {
			tids = append(tids, *v.PublishTargetID)
		}
	}
	names := func(records any, ids []uint64) (map[uint64]string, error) {
		m := map[uint64]string{}
		if len(ids) == 0 {
			return m, nil
		}
		if err := r.data.DB(ctx).Where("id IN ?", ids).Find(records).Error; err != nil {
			return nil, err
		}
		switch xs := records.(type) {
		case *[]model.Enterprise:
			for _, v := range *xs {
				m[v.ID] = v.Name
			}
		case *[]model.PublishPlan:
			for _, v := range *xs {
				m[v.ID] = v.Name
			}
		case *[]model.ArticleSnapshot:
			for _, v := range *xs {
				m[v.ID] = v.Title
			}
		case *[]model.PublishChannel:
			for _, v := range *xs {
				m[v.ID] = v.Name
			}
		case *[]model.PublishTarget:
			for _, v := range *xs {
				m[v.ID] = v.Name
			}
		}
		return m, nil
	}
	var es []model.Enterprise
	en, err := names(&es, eids)
	if err != nil {
		return nil, err
	}
	var ps []model.PublishPlan
	pn, err := names(&ps, pids)
	if err != nil {
		return nil, err
	}
	var ss []model.ArticleSnapshot
	sn, err := names(&ss, sids)
	if err != nil {
		return nil, err
	}
	var cs []model.PublishChannel
	cn, err := names(&cs, cids)
	if err != nil {
		return nil, err
	}
	var ts []model.PublishTarget
	tn, err := names(&ts, tids)
	if err != nil {
		return nil, err
	}
	for i := range records {
		v := &records[i]
		targetName := ""
		if v.PublishTargetID != nil {
			targetName = tn[*v.PublishTargetID]
		}
		items = append(items, &biz.AdminPublishTask{ID: v.ID, EnterpriseID: v.EnterpriseID, EnterpriseName: en[v.EnterpriseID], PublishPlanID: v.PublishPlanID, PublishPlanName: pn[v.PublishPlanID], ArticleSnapshotID: v.ArticleSnapshotID, ArticleTitle: sn[v.ArticleSnapshotID], PublishChannelID: v.PublishChannelID, PublishChannelName: cn[v.PublishChannelID], PublishTargetID: v.PublishTargetID, PublishTargetName: targetName, PlatformAccountID: v.PlatformAccountID, ExecutionMode: v.ExecutionMode, Status: v.Status, Priority: v.Priority, ScheduledAt: v.ScheduledAt, NextRetryAt: v.NextRetryAt, AttemptCount: v.AttemptCount, MaxAttempts: v.MaxAttempts, ResultURL: v.ResultURL, PlatformArticleID: v.PlatformArticleID, ErrorCategory: v.ErrorCategory, ErrorCode: v.ErrorCode, ErrorMessage: v.ErrorMessage, CompletedAt: v.CompletedAt, Version: v.Version, CreatedAt: v.CreatedAt, UpdatedAt: v.UpdatedAt})
	}
	return items, nil
}
func receiptDO(v *model.SubmissionReceipt) *biz.AdminSubmissionReceipt {
	return &biz.AdminSubmissionReceipt{ID: v.ID, ReceiptType: v.ReceiptType, ReceiptCode: v.ReceiptCode, Status: v.Status, SubmittedAt: v.SubmittedAt, ExpectedAt: v.ExpectedAt, PublishedAt: v.PublishedAt, PublishedURL: v.PublishedURL, CostMinorUnits: v.CostMinorUnits, Currency: v.Currency, FollowUpJSON: string(v.FollowUpJSON)}
}
func receiptPO(v *biz.AdminSubmissionReceipt) *model.SubmissionReceipt {
	return &model.SubmissionReceipt{ReceiptType: v.ReceiptType, ReceiptCode: v.ReceiptCode, Status: v.Status, SubmittedAt: v.SubmittedAt, ExpectedAt: v.ExpectedAt, PublishedAt: v.PublishedAt, PublishedURL: v.PublishedURL, CostMinorUnits: v.CostMinorUnits, Currency: v.Currency, FollowUpJSON: jsonBytes(v.FollowUpJSON)}
}
func mapAdminPublishTaskError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return biz.ErrPublishTaskNotFound
	}
	return err
}
