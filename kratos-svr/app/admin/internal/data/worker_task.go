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

type workerAdminRepo struct{ data *Data }

func NewWorkerAdminRepo(data *Data) biz.WorkerAdminRepo { return &workerAdminRepo{data: data} }
func (r *workerAdminRepo) List(ctx context.Context, o biz.WorkerListOptions) ([]*biz.WorkerNode, int64, error) {
	db := r.data.DB(ctx).Model(&model.WorkerNode{})
	if o.Status != "" {
		db = db.Where("status = ?", o.Status)
	}
	if o.ApprovalStatus != "" {
		db = db.Where("approval_status = ?", o.ApprovalStatus)
	}
	if o.Keyword != "" {
		k := "%" + o.Keyword + "%"
		db = db.Where("name LIKE ? OR node_id LIKE ? OR client_version LIKE ?", k, k, k)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var xs []model.WorkerNode
	if err := db.Order("id DESC").Offset(o.Offset).Limit(o.Limit).Find(&xs).Error; err != nil {
		return nil, 0, err
	}
	out := make([]*biz.WorkerNode, 0, len(xs))
	for i := range xs {
		out = append(out, workerDO(&xs[i]))
	}
	return out, total, nil
}
func (r *workerAdminRepo) Get(ctx context.Context, id uint64) (*biz.WorkerDetail, error) {
	var w model.WorkerNode
	if err := r.data.DB(ctx).First(&w, id).Error; err != nil {
		return nil, mapWorkerError(err)
	}
	d := &biz.WorkerDetail{Worker: workerDO(&w), Heartbeats: []*biz.WorkerHeartbeatRecord{}, Leases: []*biz.WorkerLeaseRecord{}}
	var hs []model.WorkerHeartbeat
	if err := r.data.DB(ctx).Where("worker_node_id = ?", id).Order("id DESC").Limit(50).Find(&hs).Error; err != nil {
		return nil, err
	}
	for i := range hs {
		v := &hs[i]
		d.Heartbeats = append(d.Heartbeats, &biz.WorkerHeartbeatRecord{ID: v.ID, ActiveTasks: v.ActiveTasks, MetricsJSON: string(v.MetricsJSON), ReceivedAt: v.ReceivedAt})
	}
	var ls []model.TaskLease
	if err := r.data.DB(ctx).Where("worker_node_id = ?", id).Order("id DESC").Limit(50).Find(&ls).Error; err != nil {
		return nil, err
	}
	for i := range ls {
		v := &ls[i]
		d.Leases = append(d.Leases, &biz.WorkerLeaseRecord{ID: v.ID, TaskID: v.TaskID, TaskType: v.TaskType, Status: v.Status, LeasedAt: v.LeasedAt, ExpiresAt: v.ExpiresAt, ReleasedAt: v.ReleasedAt, ReleaseReason: v.ReleaseReason})
	}
	return d, nil
}
func (r *workerAdminRepo) ChangeStatus(ctx context.Context, c biz.WorkerStatusCommand) (*biz.WorkerDetail, error) {
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var before model.WorkerNode
		if err := tx.First(&before, c.ID).Error; err != nil {
			return err
		}
		updates := map[string]any{"version": gorm.Expr("version + 1")}
		switch c.Action {
		case "approve":
			updates["approval_status"] = "approved"
			updates["status"] = "active"
		case "activate":
			updates["status"] = "active"
		case "suspend":
			updates["status"] = "suspended"
		case "revoke":
			now := time.Now().UTC()
			updates["status"] = "revoked"
			updates["approval_status"] = "revoked"
			updates["revoked_at"] = now
			if err := tx.Model(&model.TaskLease{}).Where("worker_node_id = ? AND status = ?", c.ID, "active").Updates(map[string]any{"status": "released", "released_at": now, "release_reason": "worker_revoked"}).Error; err != nil {
				return err
			}
		}
		res := tx.Model(&model.WorkerNode{}).Where("id = ? AND version = ?", c.ID, c.Version).Updates(updates)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected != 1 {
			return biz.ErrLeaseConflict
		}
		return writeAdminAudit(ctx, tx, c.OperatorID, "worker."+c.Action, "worker", strconv.FormatUint(c.ID, 10), "success", c.Reason, before, updates)
	})
	if err != nil {
		return nil, mapWorkerError(err)
	}
	return r.Get(ctx, c.ID)
}
func workerDO(v *model.WorkerNode) *biz.WorkerNode {
	return &biz.WorkerNode{ID: v.ID, NodeID: v.NodeID, Name: v.Name, Status: v.Status, ApprovalStatus: v.ApprovalStatus, ClientVersion: v.ClientVersion, DriverVersionsJSON: string(v.DriverVersionsJSON), CapabilitiesJSON: string(v.CapabilitiesJSON), SystemInfoJSON: string(v.SystemInfoJSON), MaxConcurrency: v.MaxConcurrency, LastHeartbeatAt: v.LastHeartbeatAt, RevokedAt: v.RevokedAt, Version: v.Version, CreatedAt: v.CreatedAt, UpdatedAt: v.UpdatedAt}
}
func mapWorkerError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return biz.ErrWorkerInvalid
	}
	return err
}
