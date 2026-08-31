package data

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/data/model"

	"gorm.io/gorm"
)

const enterpriseAccountRequester = "enterprise_account"

type exportJobRepo struct {
	data *Data
}

func NewExportJobRepo(data *Data) biz.ExportJobRepo {
	return &exportJobRepo{data: data}
}

func (r *exportJobRepo) Create(ctx context.Context, job *biz.ExportJob) (*biz.ExportJob, error) {
	record := exportJobPO(job)
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var existing model.ExportJob
		err := tx.Where("enterprise_id = ? AND client_request_id = ?", job.EnterpriseID, job.ClientRequestID).First(&existing).Error
		if err == nil {
			if !sameExportRequest(&existing, job) {
				return biz.ErrExportJobConflict
			}
			*record = existing
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if err := tx.Create(record).Error; err != nil {
			if !errors.Is(err, gorm.ErrDuplicatedKey) {
				return err
			}
			// A concurrent retry may have inserted the same idempotency key
			// after our initial lookup. Return that job only when its frozen
			// request is identical.
			if err := tx.Where("enterprise_id = ? AND client_request_id = ?", job.EnterpriseID, job.ClientRequestID).First(&existing).Error; err != nil {
				return err
			}
			if !sameExportRequest(&existing, job) {
				return biz.ErrExportJobConflict
			}
			*record = existing
			return nil
		}
		payload, err := json.Marshal(map[string]any{
			"export_job_id": record.ID, "enterprise_id": job.EnterpriseID,
			"resource_type": job.ResourceType, "format": job.Format,
		})
		if err != nil {
			return err
		}
		return tx.Create(&model.OutboxEvent{
			AggregateType: "export_job", AggregateID: fmt.Sprint(record.ID), EventType: "export.job.created",
			PayloadJSON: payload, IdempotencyKey: exportOutboxKey("created", job.EnterpriseID, job.ClientRequestID),
			Status: "pending", AvailableAt: time.Now().UTC(),
		}).Error
	})
	if err != nil {
		return nil, mapExportJobError(err)
	}
	return exportJobDO(record), nil
}

func (r *exportJobRepo) Get(ctx context.Context, enterpriseID, accountID, id uint64) (*biz.ExportJob, error) {
	var record model.ExportJob
	if err := exportJobScope(r.data.DB(ctx), enterpriseID, accountID).Where("id = ?", id).First(&record).Error; err != nil {
		return nil, mapExportJobError(err)
	}
	return exportJobDO(&record), nil
}

func (r *exportJobRepo) List(ctx context.Context, enterpriseID, accountID uint64, opts biz.ExportJobListOptions) ([]*biz.ExportJob, int64, error) {
	db := exportJobScope(r.data.DB(ctx).Model(&model.ExportJob{}), enterpriseID, accountID)
	if opts.ResourceType != "" {
		db = db.Where("resource_type = ?", opts.ResourceType)
	}
	if opts.Format != "" {
		db = db.Where("format = ?", opts.Format)
	}
	if opts.Status != "" {
		db = db.Where("status = ?", opts.Status)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var records []model.ExportJob
	if err := db.Order("created_at DESC, id DESC").Offset(opts.Offset).Limit(opts.Limit).Find(&records).Error; err != nil {
		return nil, 0, err
	}
	items := make([]*biz.ExportJob, 0, len(records))
	for i := range records {
		items = append(items, exportJobDO(&records[i]))
	}
	return items, total, nil
}

func (r *exportJobRepo) Cancel(ctx context.Context, enterpriseID, accountID, id uint64) (*biz.ExportJob, error) {
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		now := time.Now().UTC()
		result := exportJobScope(tx.Model(&model.ExportJob{}), enterpriseID, accountID).
			Where("id = ? AND status = ?", id, "queued").Updates(map[string]any{"status": "cancelled", "cancelled_at": now})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			var current model.ExportJob
			if err := exportJobScope(tx, enterpriseID, accountID).Where("id = ?", id).First(&current).Error; err != nil {
				return err
			}
			if current.Status == "cancelled" {
				return nil
			}
			return biz.ErrExportJobConflict
		}
		payload, err := json.Marshal(map[string]any{"export_job_id": id, "enterprise_id": enterpriseID})
		if err != nil {
			return err
		}
		return tx.Create(&model.OutboxEvent{
			AggregateType: "export_job", AggregateID: fmt.Sprint(id), EventType: "export.job.cancelled",
			PayloadJSON: payload, IdempotencyKey: fmt.Sprintf("export-job-cancelled:%d", id),
			Status: "pending", AvailableAt: now,
		}).Error
	})
	if err != nil {
		return nil, mapExportJobError(err)
	}
	return r.Get(ctx, enterpriseID, accountID, id)
}

func exportJobScope(db *gorm.DB, enterpriseID, accountID uint64) *gorm.DB {
	return db.Where("enterprise_id = ? AND requested_by_type = ? AND requested_by_id = ?", enterpriseID, enterpriseAccountRequester, accountID)
}

func exportJobPO(job *biz.ExportJob) *model.ExportJob {
	enterpriseID := job.EnterpriseID
	return &model.ExportJob{
		EnterpriseID: &enterpriseID, RequestedByType: enterpriseAccountRequester, RequestedByID: job.RequestedByID,
		ResourceType: job.ResourceType, Format: job.Format, FilterJSON: []byte(job.FilterJSON),
		ClientRequestID: job.ClientRequestID, Status: job.Status,
	}
}

func exportJobDO(record *model.ExportJob) *biz.ExportJob {
	if record == nil {
		return nil
	}
	enterpriseID := uint64(0)
	if record.EnterpriseID != nil {
		enterpriseID = *record.EnterpriseID
	}
	return &biz.ExportJob{
		ID: record.ID, EnterpriseID: enterpriseID, RequestedByID: record.RequestedByID,
		ResourceType: record.ResourceType, Format: record.Format, FilterJSON: string(record.FilterJSON),
		ClientRequestID: record.ClientRequestID, Status: record.Status, ObjectKey: record.ObjectKey,
		FileHash: record.FileHash, ExpiresAt: record.ExpiresAt, ErrorMessage: record.ErrorMessage,
		CompletedAt: record.CompletedAt, CancelledAt: record.CancelledAt,
		CreatedAt: record.CreatedAt, UpdatedAt: record.UpdatedAt,
	}
}

func sameExportRequest(record *model.ExportJob, job *biz.ExportJob) bool {
	return record.RequestedByType == enterpriseAccountRequester && record.RequestedByID == job.RequestedByID &&
		record.ResourceType == job.ResourceType && record.Format == job.Format && string(record.FilterJSON) == job.FilterJSON
}

func exportOutboxKey(action string, enterpriseID uint64, clientRequestID string) string {
	digest := sha256.Sum256([]byte(fmt.Sprintf("%d:%s", enterpriseID, clientRequestID)))
	return "export-job-" + action + ":" + hex.EncodeToString(digest[:])
}

func mapExportJobError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return biz.ErrExportJobNotFound
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return biz.ErrExportJobConflict
	}
	return err
}
