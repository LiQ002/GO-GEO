package data

import (
	"context"
	"errors"
	"gorm.io/gorm"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/data/model"
)

type adminAuditLogRepo struct{ data *Data }

func NewAdminAuditLogRepo(data *Data) biz.AdminAuditLogRepo { return &adminAuditLogRepo{data: data} }
func (r *adminAuditLogRepo) List(ctx context.Context, o biz.AdminAuditLogListOptions) ([]*biz.AdminAuditLog, int64, error) {
	db := r.data.DB(ctx).Model(&model.AuditLog{})
	if o.EnterpriseID != nil {
		if *o.EnterpriseID == 0 {
			db = db.Where("enterprise_id IS NULL")
		} else {
			db = db.Where("enterprise_id = ?", *o.EnterpriseID)
		}
	}
	if o.ActorType != "" {
		db = db.Where("actor_type = ?", o.ActorType)
	}
	if o.ActorID != 0 {
		db = db.Where("actor_id = ?", o.ActorID)
	}
	if o.Action != "" {
		db = db.Where("action LIKE ?", "%"+o.Action+"%")
	}
	if o.ResourceType != "" {
		db = db.Where("resource_type = ?", o.ResourceType)
	}
	if o.Result != "" {
		db = db.Where("result = ?", o.Result)
	}
	if o.RequestID != "" {
		db = db.Where("request_id = ?", o.RequestID)
	}
	if o.StartedAt != nil {
		db = db.Where("created_at >= ?", *o.StartedAt)
	}
	if o.EndedAt != nil {
		db = db.Where("created_at <= ?", *o.EndedAt)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var xs []model.AuditLog
	if err := db.Order("id DESC").Offset(o.Offset).Limit(o.Limit).Find(&xs).Error; err != nil {
		return nil, 0, err
	}
	return r.hydrate(ctx, xs), total, nil
}
func (r *adminAuditLogRepo) Get(ctx context.Context, id uint64) (*biz.AdminAuditLog, error) {
	var v model.AuditLog
	if err := r.data.DB(ctx).First(&v, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, biz.ErrAuditLogNotFound
		}
		return nil, err
	}
	return r.hydrate(ctx, []model.AuditLog{v})[0], nil
}
func (r *adminAuditLogRepo) hydrate(ctx context.Context, xs []model.AuditLog) []*biz.AdminAuditLog {
	eids, aids := []uint64{}, []uint64{}
	for _, v := range xs {
		if v.EnterpriseID != nil {
			eids = append(eids, *v.EnterpriseID)
		}
		if v.ActorType == "admin" {
			aids = append(aids, v.ActorID)
		}
	}
	en, an := map[uint64]string{}, map[uint64]string{}
	var es []model.Enterprise
	r.data.DB(ctx).Where("id IN ?", eids).Find(&es)
	for _, v := range es {
		en[v.ID] = v.Name
	}
	var as []model.AdminUser
	r.data.DB(ctx).Where("id IN ?", aids).Find(&as)
	for _, v := range as {
		an[v.ID] = v.DisplayName
	}
	out := make([]*biz.AdminAuditLog, 0, len(xs))
	for i := range xs {
		v := &xs[i]
		enterpriseName := ""
		if v.EnterpriseID != nil {
			enterpriseName = en[*v.EnterpriseID]
		}
		out = append(out, &biz.AdminAuditLog{ID: v.ID, EnterpriseID: v.EnterpriseID, EnterpriseName: enterpriseName, ActorType: v.ActorType, ActorID: v.ActorID, ActorName: an[v.ActorID], Audience: v.Audience, Action: v.Action, ResourceType: v.ResourceType, ResourceID: v.ResourceID, Result: v.Result, Reason: v.Reason, BeforeJSON: string(v.BeforeJSON), AfterJSON: string(v.AfterJSON), IPAddress: v.IPAddress, UserAgent: v.UserAgent, RequestID: v.RequestID, TraceID: v.TraceID, CreatedAt: v.CreatedAt})
	}
	return out
}
