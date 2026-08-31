package data

import (
	"context"
	"errors"
	"gorm.io/gorm"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/data/model"
)

type publishChannelRepo struct{ data *Data }

func NewPublishChannelRepo(data *Data) biz.PublishChannelRepo { return &publishChannelRepo{data: data} }
func (r *publishChannelRepo) Create(ctx context.Context, item *biz.PublishChannel) (*biz.PublishChannel, error) {
	po := publishChannelPO(item)
	if err := r.data.DB(ctx).Create(po).Error; err != nil {
		return nil, mapPublishChannelError(err)
	}
	return publishChannelDO(po), nil
}
func (r *publishChannelRepo) Get(ctx context.Context, id uint64) (*biz.PublishChannel, error) {
	var po model.PublishChannel
	if err := r.data.DB(ctx).First(&po, id).Error; err != nil {
		return nil, mapPublishChannelError(err)
	}
	return publishChannelDO(&po), nil
}
func (r *publishChannelRepo) List(ctx context.Context, o biz.PublishChannelListOptions) ([]*biz.PublishChannel, int64, error) {
	db := r.data.DB(ctx).Model(&model.PublishChannel{})
	if o.Category != 0 {
		db = db.Where("category = ?", o.Category)
	}
	if o.Status != 0 {
		db = db.Where("status = ?", o.Status)
	}
	if o.Keyword != "" {
		k := "%" + o.Keyword + "%"
		db = db.Where("name LIKE ? OR code LIKE ?", k, k)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, mapPublishChannelError(err)
	}
	var rows []model.PublishChannel
	if err := db.Order("sort_order ASC, id DESC").Offset(o.Offset).Limit(o.Limit).Find(&rows).Error; err != nil {
		return nil, 0, mapPublishChannelError(err)
	}
	items := make([]*biz.PublishChannel, 0, len(rows))
	for i := range rows {
		items = append(items, publishChannelDO(&rows[i]))
	}
	return items, total, nil
}
func (r *publishChannelRepo) Update(ctx context.Context, item *biz.PublishChannel) (*biz.PublishChannel, error) {
	updates := map[string]any{"driver_type": item.DriverType, "login_url": item.LoginURL, "name": item.Name, "category": item.Category, "icon": item.Icon, "description": item.Description, "status": item.Status, "authorization_type": item.AuthorizationType, "execution_mode": item.ExecutionMode, "driver_version": item.DriverVersion, "sort_order": item.SortOrder, "version": gorm.Expr("version + 1")}
	res := r.data.DB(ctx).Model(&model.PublishChannel{}).Where("id = ? AND version = ?", item.ID, item.Version).Updates(updates)
	if res.Error != nil {
		return nil, mapPublishChannelError(res.Error)
	}
	if res.RowsAffected != 1 {
		return nil, biz.ErrPublishChannelConflict
	}
	return r.Get(ctx, item.ID)
}
func (r *publishChannelRepo) Delete(ctx context.Context, id, version uint64) error {
	res := r.data.DB(ctx).Where("id = ? AND version = ?", id, version).Delete(&model.PublishChannel{})
	if res.Error != nil {
		return mapPublishChannelError(res.Error)
	}
	if res.RowsAffected != 1 {
		return biz.ErrPublishChannelConflict
	}
	return nil
}
func (r *publishChannelRepo) CreateTarget(ctx context.Context, item *biz.PublishTarget) (*biz.PublishTarget, error) {
	po := publishTargetPO(item)
	if err := r.data.DB(ctx).Create(po).Error; err != nil {
		return nil, mapPublishChannelError(err)
	}
	return publishTargetDO(po), nil
}
func (r *publishChannelRepo) ListTargets(ctx context.Context, o biz.PublishTargetListOptions) ([]*biz.PublishTarget, error) {
	db := r.data.DB(ctx).Where("publish_channel_id = ?", o.PublishChannelID)
	if o.TargetType != 0 {
		db = db.Where("target_type = ?", o.TargetType)
	}
	if o.Status != 0 {
		db = db.Where("status = ?", o.Status)
	}
	var rows []model.PublishTarget
	if err := db.Order("sort_order ASC, id DESC").Find(&rows).Error; err != nil {
		return nil, mapPublishChannelError(err)
	}
	items := make([]*biz.PublishTarget, 0, len(rows))
	for i := range rows {
		items = append(items, publishTargetDO(&rows[i]))
	}
	return items, nil
}
func (r *publishChannelRepo) UpdateTarget(ctx context.Context, item *biz.PublishTarget) (*biz.PublishTarget, error) {
	updates := map[string]any{"name": item.Name, "target_type": item.TargetType, "platform": item.Platform, "entry_url": item.EntryURL, "submission_email": item.SubmissionEmail, "region": item.Region, "industry": item.Industry, "cooperation_json": jsonBytes(item.CooperationJSON), "requirements_json": jsonBytes(item.RequirementsJSON), "status": item.Status, "sort_order": item.SortOrder, "version": gorm.Expr("version + 1")}
	res := r.data.DB(ctx).Model(&model.PublishTarget{}).Where("id = ? AND publish_channel_id = ? AND version = ?", item.ID, item.PublishChannelID, item.Version).Updates(updates)
	if res.Error != nil {
		return nil, mapPublishChannelError(res.Error)
	}
	if res.RowsAffected != 1 {
		return nil, biz.ErrPublishChannelConflict
	}
	var po model.PublishTarget
	if err := r.data.DB(ctx).Where("id = ? AND publish_channel_id = ?", item.ID, item.PublishChannelID).First(&po).Error; err != nil {
		return nil, mapPublishChannelError(err)
	}
	return publishTargetDO(&po), nil
}
func (r *publishChannelRepo) DeleteTarget(ctx context.Context, channelID, targetID, version uint64) error {
	res := r.data.DB(ctx).Where("id = ? AND publish_channel_id = ? AND version = ?", targetID, channelID, version).Delete(&model.PublishTarget{})
	if res.Error != nil {
		return mapPublishChannelError(res.Error)
	}
	if res.RowsAffected != 1 {
		return biz.ErrPublishChannelConflict
	}
	return nil
}
func publishChannelPO(i *biz.PublishChannel) *model.PublishChannel {
	return &model.PublishChannel{Code: i.Code, DriverType: i.DriverType, LoginURL: i.LoginURL, Name: i.Name, Category: i.Category, Icon: i.Icon, Description: i.Description, Status: i.Status, AuthorizationType: i.AuthorizationType, ExecutionMode: i.ExecutionMode, DriverVersion: i.DriverVersion, SortOrder: i.SortOrder, Version: 1}
}
func publishChannelDO(i *model.PublishChannel) *biz.PublishChannel {
	return &biz.PublishChannel{ID: i.ID, Code: i.Code, DriverType: i.DriverType, LoginURL: i.LoginURL, Name: i.Name, Category: i.Category, Icon: i.Icon, Description: i.Description, Status: i.Status, AuthorizationType: i.AuthorizationType, ExecutionMode: i.ExecutionMode, DriverVersion: i.DriverVersion, SortOrder: i.SortOrder, Version: i.Version, CreatedAt: i.CreatedAt, UpdatedAt: i.UpdatedAt}
}
func publishTargetPO(i *biz.PublishTarget) *model.PublishTarget {
	return &model.PublishTarget{PublishChannelID: i.PublishChannelID, Name: i.Name, TargetType: i.TargetType, Platform: i.Platform, EntryURL: i.EntryURL, SubmissionEmail: i.SubmissionEmail, Region: i.Region, Industry: i.Industry, CooperationJSON: jsonBytes(i.CooperationJSON), RequirementsJSON: jsonBytes(i.RequirementsJSON), Status: i.Status, SortOrder: i.SortOrder, Version: 1}
}
func publishTargetDO(i *model.PublishTarget) *biz.PublishTarget {
	return &biz.PublishTarget{ID: i.ID, PublishChannelID: i.PublishChannelID, Name: i.Name, TargetType: i.TargetType, Platform: i.Platform, EntryURL: i.EntryURL, SubmissionEmail: i.SubmissionEmail, Region: i.Region, Industry: i.Industry, CooperationJSON: string(i.CooperationJSON), RequirementsJSON: string(i.RequirementsJSON), Status: i.Status, SortOrder: i.SortOrder, Version: i.Version, CreatedAt: i.CreatedAt, UpdatedAt: i.UpdatedAt}
}
func mapPublishChannelError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return biz.ErrPublishChannelNotFound
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return biz.ErrPublishChannelConflict
	}
	return err
}
