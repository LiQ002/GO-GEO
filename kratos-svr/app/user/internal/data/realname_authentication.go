package data

import (
	"context"
	stderrors "errors"

	"kratos-svr/app/user/internal/biz"
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

func realnamePO(item *biz.RealnameAuthentication) *model.RealnameAuthentication {
	return &model.RealnameAuthentication{
		TenantModel:      model.TenantModel{EnterpriseID: item.EnterpriseID},
		Type:             item.Type,
		Status:           item.Status,
		RealName:         item.RealName,
		IDCardNumber:     item.IDCardNumber,
		Mobile:           item.Mobile,
		CompanyName:      item.CompanyName,
		RegistrationNo:   item.RegistrationNo,
		LicenseImageURL:  item.LicenseImageURL,
		IDCardImageURL:   item.IDCardImageURL,
		RejectReason:     item.RejectReason,
		ReviewedBy:       item.ReviewedBy,
		ReviewedAt:       item.ReviewedAt,
		SubmittedAt:      item.SubmittedAt,
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
