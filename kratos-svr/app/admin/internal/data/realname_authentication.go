package data

import (
	"context"
	stderrors "errors"
	"fmt"
	"time"

	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/data/model"

	"gorm.io/gorm"
)

type realnameRepo struct{ data *Data }

func NewRealnameRepo(data *Data) biz.RealnameRepo { return &realnameRepo{data: data} }

func (r *realnameRepo) Create(ctx context.Context, item *biz.RealnameAuthentication) error {
	po := realnamePO(item)
	return r.data.DB(ctx).Create(po).Error
}

func (r *realnameRepo) GetByEnterprise(ctx context.Context, enterpriseID uint64) (*biz.RealnameAuthentication, error) {
	var po model.RealnameAuthentication
	if err := r.data.DB(ctx).Where("enterprise_id = ?", enterpriseID).Order("id DESC").First(&po).Error; err != nil {
		if stderrors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return realnameDO(&po), nil
}

func (r *realnameRepo) Get(ctx context.Context, id uint64) (*biz.RealnameAuthenticationDetail, error) {
	var po model.RealnameAuthentication
	if err := r.data.DB(ctx).First(&po, id).Error; err != nil {
		return nil, biz.MapRealnameError(err)
	}
	return r.hydrate(ctx, []model.RealnameAuthentication{po})[0], nil
}

func (r *realnameRepo) List(ctx context.Context, opts biz.RealnameListOptions) ([]*biz.RealnameAuthenticationDetail, int64, error) {
	db := r.data.DB(ctx).Model(&model.RealnameAuthentication{})
	if opts.Keyword != "" {
		keyword := "%" + opts.Keyword + "%"
		subQuery := r.data.DB(ctx).Model(&model.Enterprise{}).
			Select("id").
			Where("name LIKE ? OR code LIKE ?", keyword, keyword)
		db = db.Where("enterprise_id IN (?) OR real_name LIKE ? OR mobile LIKE ? OR company_name LIKE ?",
			subQuery, keyword, keyword, keyword)
	}
	if opts.Status != "" {
		db = db.Where("status = ?", opts.Status)
	}
	if opts.Type != "" {
		db = db.Where("type = ?", opts.Type)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, biz.MapRealnameError(err)
	}
	var records []model.RealnameAuthentication
	if err := db.Order("id DESC").Offset(opts.Offset).Limit(opts.Limit).Find(&records).Error; err != nil {
		return nil, 0, biz.MapRealnameError(err)
	}
	items := r.hydrate(ctx, records)
	return items, total, nil
}

func (r *realnameRepo) Approve(ctx context.Context, id, operatorID uint64) (*biz.RealnameAuthenticationDetail, error) {
	now := time.Now().UTC()
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		result := tx.Model(&model.RealnameAuthentication{}).Where("id = ? AND status = ?", id, "pending").
			Updates(map[string]any{
				"status":      "approved",
				"reviewed_by": operatorID,
				"reviewed_at": now,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return biz.ErrRealnameNotFound
		}
		return writeAdminAudit(ctx, tx, operatorID, "realname.approve", "realname_authentication", fmt.Sprintf("%d", id), "success", "", nil, map[string]any{"status": "approved"})
	})
	if err != nil {
		return nil, biz.MapRealnameError(err)
	}
	return r.Get(ctx, id)
}

func (r *realnameRepo) Reject(ctx context.Context, id uint64, rejectReason string, operatorID uint64) (*biz.RealnameAuthenticationDetail, error) {
	now := time.Now().UTC()
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		result := tx.Model(&model.RealnameAuthentication{}).Where("id = ? AND status IN ?", id, []string{"pending", "approved"}).
			Updates(map[string]any{
				"status":        "rejected",
				"reject_reason": rejectReason,
				"reviewed_by":   operatorID,
				"reviewed_at":   now,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return biz.ErrRealnameNotFound
		}
		return writeAdminAudit(ctx, tx, operatorID, "realname.reject", "realname_authentication", fmt.Sprintf("%d", id), "success", rejectReason, nil, map[string]any{"status": "rejected"})
	})
	if err != nil {
		return nil, biz.MapRealnameError(err)
	}
	return r.Get(ctx, id)
}

func (r *realnameRepo) Delete(ctx context.Context, id uint64) error {
	return r.data.DB(ctx).Delete(&model.RealnameAuthentication{}, id).Error
}

func (r *realnameRepo) hydrate(ctx context.Context, records []model.RealnameAuthentication) []*biz.RealnameAuthenticationDetail {
	items := make([]*biz.RealnameAuthenticationDetail, 0, len(records))
	if len(records) == 0 {
		return items
	}
	enterpriseIDs := make([]uint64, 0, len(records))
	for i := range records {
		enterpriseIDs = append(enterpriseIDs, records[i].EnterpriseID)
		items = append(items, &biz.RealnameAuthenticationDetail{
			Authentication: realnameDO(&records[i]),
		})
	}
	var enterprises []model.Enterprise
	r.data.DB(ctx).Where("id IN ?", enterpriseIDs).Find(&enterprises)
	enterpriseMap := make(map[uint64]*model.Enterprise, len(enterprises))
	for i := range enterprises {
		enterpriseMap[enterprises[i].ID] = &enterprises[i]
	}
	var accounts []model.EnterpriseAccount
	r.data.DB(ctx).Where("enterprise_id IN ?", enterpriseIDs).Find(&accounts)
	accountMap := make(map[uint64]*model.EnterpriseAccount, len(accounts))
	for i := range accounts {
		accountMap[accounts[i].EnterpriseID] = &accounts[i]
	}
	for _, item := range items {
		ent := enterpriseMap[item.Authentication.EnterpriseID]
		if ent != nil {
			item.EnterpriseName = ent.Name
			item.EnterpriseCode = ent.Code
		}
		acc := accountMap[item.Authentication.EnterpriseID]
		if acc != nil {
			item.Username = acc.Username
		}
	}
	return items
}

func realnamePO(item *biz.RealnameAuthentication) *model.RealnameAuthentication {
	return &model.RealnameAuthentication{
		TenantModel:     model.TenantModel{EnterpriseID: item.EnterpriseID},
		Type:            item.Type,
		Status:          item.Status,
		RealName:        item.RealName,
		IDCardNumber:    item.IDCardNumber,
		Mobile:          item.Mobile,
		CompanyName:     item.CompanyName,
		RegistrationNo:  item.RegistrationNo,
		LicenseImageURL: item.LicenseImageURL,
		IDCardImageURL:  item.IDCardImageURL,
		RejectReason:    item.RejectReason,
		ReviewedBy:      item.ReviewedBy,
		ReviewedAt:      item.ReviewedAt,
		SubmittedAt:     item.SubmittedAt,
	}
}

func realnameDO(item *model.RealnameAuthentication) *biz.RealnameAuthentication {
	return &biz.RealnameAuthentication{
		ID:              item.ID,
		EnterpriseID:    item.EnterpriseID,
		Type:            item.Type,
		Status:          item.Status,
		RealName:        item.RealName,
		IDCardNumber:    item.IDCardNumber,
		Mobile:          item.Mobile,
		CompanyName:     item.CompanyName,
		RegistrationNo:  item.RegistrationNo,
		LicenseImageURL: item.LicenseImageURL,
		IDCardImageURL:  item.IDCardImageURL,
		RejectReason:    item.RejectReason,
		ReviewedBy:      item.ReviewedBy,
		ReviewedAt:      item.ReviewedAt,
		SubmittedAt:     item.SubmittedAt,
		CreatedAt:       item.CreatedAt,
		UpdatedAt:       item.UpdatedAt,
	}
}
