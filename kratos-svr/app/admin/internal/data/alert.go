package data

import (
	"context"
	"errors"
	"gorm.io/gorm"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/data/model"
	"strconv"
	"time"
)

type adminAlertRepo struct{ data *Data }

func NewAdminAlertRepo(data *Data) biz.AdminAlertRepo { return &adminAlertRepo{data: data} }
func (r *adminAlertRepo) List(ctx context.Context, o biz.AdminAlertListOptions) ([]*biz.AdminAlert, int64, error) {
	db := r.data.DB(ctx).Model(&model.Alert{})
	if o.EnterpriseID != nil {
		if *o.EnterpriseID == 0 {
			db = db.Where("enterprise_id IS NULL")
		} else {
			db = db.Where("enterprise_id = ?", *o.EnterpriseID)
		}
	}
	if o.Severity != "" {
		db = db.Where("severity = ?", o.Severity)
	}
	if o.Status != "" {
		db = db.Where("status = ?", o.Status)
	}
	if o.AlertType != "" {
		db = db.Where("alert_type = ?", o.AlertType)
	}
	if o.Keyword != "" {
		k := "%" + o.Keyword + "%"
		db = db.Where("title LIKE ? OR description LIKE ?", k, k)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var xs []model.Alert
	if err := db.Order("id DESC").Offset(o.Offset).Limit(o.Limit).Find(&xs).Error; err != nil {
		return nil, 0, err
	}
	return r.hydrate(ctx, xs), total, nil
}
func (r *adminAlertRepo) Get(ctx context.Context, id uint64) (*biz.AdminAlert, error) {
	var v model.Alert
	if err := r.data.DB(ctx).First(&v, id).Error; err != nil {
		return nil, mapAlertError(err)
	}
	return r.hydrate(ctx, []model.Alert{v})[0], nil
}
func (r *adminAlertRepo) Resolve(ctx context.Context, c biz.ResolveAlertCommand) (*biz.AdminAlert, error) {
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var before model.Alert
		if err := tx.First(&before, c.ID).Error; err != nil {
			return err
		}
		if before.Status == "resolved" {
			return biz.ErrAlertInvalid
		}
		now := time.Now().UTC()
		if err := tx.Model(&before).Updates(map[string]any{"status": "resolved", "resolved_at": now, "resolved_by": c.OperatorID}).Error; err != nil {
			return err
		}
		return writeAdminAudit(ctx, tx, c.OperatorID, "alert.resolve", "alert", strconv.FormatUint(c.ID, 10), "success", c.Reason, before, map[string]any{"status": "resolved"})
	})
	if err != nil {
		return nil, mapAlertError(err)
	}
	return r.Get(ctx, c.ID)
}
func (r *adminAlertRepo) hydrate(ctx context.Context, xs []model.Alert) []*biz.AdminAlert {
	ids := []uint64{}
	for _, v := range xs {
		if v.EnterpriseID != nil {
			ids = append(ids, *v.EnterpriseID)
		}
	}
	names := map[uint64]string{}
	var es []model.Enterprise
	r.data.DB(ctx).Where("id IN ?", ids).Find(&es)
	for _, v := range es {
		names[v.ID] = v.Name
	}
	out := make([]*biz.AdminAlert, 0, len(xs))
	for i := range xs {
		v := &xs[i]
		name := ""
		if v.EnterpriseID != nil {
			name = names[*v.EnterpriseID]
		}
		out = append(out, &biz.AdminAlert{ID: v.ID, EnterpriseID: v.EnterpriseID, EnterpriseName: name, AlertType: v.AlertType, Severity: v.Severity, Status: v.Status, Title: v.Title, Description: v.Description, ResourceType: v.ResourceType, ResourceID: v.ResourceID, DetailsJSON: string(v.DetailsJSON), ResolvedAt: v.ResolvedAt, ResolvedBy: v.ResolvedBy, CreatedAt: v.CreatedAt, UpdatedAt: v.UpdatedAt})
	}
	return out
}
func mapAlertError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return biz.ErrAlertNotFound
	}
	return err
}
