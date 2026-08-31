package biz

import (
	"context"
	stderrors "errors"
	"strings"
	"time"

	"github.com/go-kratos/kratos/v3/errors"
	"gorm.io/gorm"
)

var (
	ErrRealnameNotFound       = errors.NotFound("REALNAME_NOT_FOUND", "realname authentication not found")
	ErrRealnameInvalid        = errors.BadRequest("REALNAME_INVALID", "invalid realname authentication data")
	ErrRealnameTypeRequired   = errors.BadRequest("REALNAME_TYPE_REQUIRED", "realname type is required")
	ErrRealnameNameRequired   = errors.BadRequest("REALNAME_NAME_REQUIRED", "real name is required")
	ErrRealnameIDCardRequired = errors.BadRequest("REALNAME_IDCARD_REQUIRED", "id card number is required")
	ErrRealnameMobileRequired = errors.BadRequest("REALNAME_MOBILE_REQUIRED", "mobile is required")
	ErrRealnameCompanyRequired = errors.BadRequest("REALNAME_COMPANY_REQUIRED", "company name is required for enterprise authentication")
	ErrRealnameRegNoRequired  = errors.BadRequest("REALNAME_REGNO_REQUIRED", "registration number is required for enterprise authentication")
	ErrRealnameLicenseRequired = errors.BadRequest("REALNAME_LICENSE_REQUIRED", "license image is required for enterprise authentication")
	ErrRealnameAlreadyExists  = errors.Conflict("REALNAME_ALREADY_EXISTS", "realname authentication already submitted")
	ErrRealnameConflict       = errors.Conflict("REALNAME_CONFLICT", "realname authentication data has changed")
)

type RealnameAuthentication struct {
	ID             uint64
	EnterpriseID   uint64
	Type           string
	Status         string
	RealName       string
	IDCardNumber   string
	Mobile         string
	CompanyName    string
	RegistrationNo string
	LicenseImageURL string
	IDCardImageURL  string
	RejectReason   string
	ReviewedBy     *uint64
	ReviewedAt     *time.Time
	SubmittedAt    time.Time
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type RealnameAuthenticationDetail struct {
	Authentication *RealnameAuthentication
	EnterpriseName string
	EnterpriseCode string
	Username       string
}

type RealnameSubmitCommand struct {
	Type           string
	RealName       string
	IDCardNumber   string
	Mobile         string
	CompanyName    string
	RegistrationNo string
	LicenseImageURL string
	IDCardImageURL  string
	OperatorID     uint64
}

type RealnameReviewCommand struct {
	ID          uint64
	RejectReason string
	OperatorID  uint64
}

type RealnameListOptions struct {
	Offset  int
	Limit   int
	Keyword string
	Status  string
	Type    string
}

type RealnameRepo interface {
	Create(context.Context, *RealnameAuthentication) error
	GetByEnterprise(context.Context, uint64) (*RealnameAuthentication, error)
	Get(context.Context, uint64) (*RealnameAuthenticationDetail, error)
	List(context.Context, RealnameListOptions) ([]*RealnameAuthenticationDetail, int64, error)
	Approve(context.Context, uint64, uint64) (*RealnameAuthenticationDetail, error)
	Reject(context.Context, uint64, string, uint64) (*RealnameAuthenticationDetail, error)
	Delete(context.Context, uint64) error
}

type RealnameUsecase struct{ repo RealnameRepo }

func NewRealnameUsecase(repo RealnameRepo) *RealnameUsecase {
	return &RealnameUsecase{repo: repo}
}

func (uc *RealnameUsecase) Submit(ctx context.Context, cmd RealnameSubmitCommand) (*RealnameAuthentication, error) {
	if cmd.OperatorID == 0 {
		return nil, ErrAdminSession
	}
	cmd.Type = "enterprise"
	cmd.RealName = strings.TrimSpace(cmd.RealName)
	cmd.IDCardNumber = strings.TrimSpace(cmd.IDCardNumber)
	cmd.Mobile = strings.TrimSpace(cmd.Mobile)
	cmd.CompanyName = strings.TrimSpace(cmd.CompanyName)
	cmd.RegistrationNo = strings.TrimSpace(cmd.RegistrationNo)

	if cmd.RealName == "" {
		return nil, ErrRealnameNameRequired
	}
	if cmd.IDCardNumber == "" {
		return nil, ErrRealnameIDCardRequired
	}
	if cmd.Mobile == "" {
		return nil, ErrRealnameMobileRequired
	}
	if cmd.CompanyName == "" {
		return nil, ErrRealnameCompanyRequired
	}
	if cmd.RegistrationNo == "" {
		return nil, ErrRealnameRegNoRequired
	}
	if cmd.LicenseImageURL == "" {
		return nil, ErrRealnameLicenseRequired
	}

	existing, _ := uc.repo.GetByEnterprise(ctx, cmd.OperatorID)
	if existing != nil {
		if existing.Status == "pending" {
			return nil, ErrRealnameAlreadyExists
		}
	}

	item := &RealnameAuthentication{
		EnterpriseID:   cmd.OperatorID,
		Type:           "enterprise",
		Status:         "pending",
		RealName:       cmd.RealName,
		IDCardNumber:   cmd.IDCardNumber,
		Mobile:         cmd.Mobile,
		CompanyName:    cmd.CompanyName,
		RegistrationNo: cmd.RegistrationNo,
		LicenseImageURL: cmd.LicenseImageURL,
		IDCardImageURL:  cmd.IDCardImageURL,
		SubmittedAt:    time.Now().UTC(),
	}
	if err := uc.repo.Create(ctx, item); err != nil {
		return nil, err
	}
	return item, nil
}

func (uc *RealnameUsecase) GetMine(ctx context.Context, enterpriseID uint64) (*RealnameAuthentication, error) {
	if enterpriseID == 0 {
		return nil, ErrRealnameInvalid
	}
	return uc.repo.GetByEnterprise(ctx, enterpriseID)
}

func (uc *RealnameUsecase) List(ctx context.Context, opts RealnameListOptions) ([]*RealnameAuthenticationDetail, int64, error) {
	return uc.repo.List(ctx, opts)
}

func (uc *RealnameUsecase) Approve(ctx context.Context, id, operatorID uint64) (*RealnameAuthenticationDetail, error) {
	if id == 0 || operatorID == 0 {
		return nil, ErrRealnameInvalid
	}
	return uc.repo.Approve(ctx, id, operatorID)
}

func (uc *RealnameUsecase) Reject(ctx context.Context, id uint64, rejectReason string, operatorID uint64) (*RealnameAuthenticationDetail, error) {
	if id == 0 || operatorID == 0 {
		return nil, ErrRealnameInvalid
	}
	rejectReason = strings.TrimSpace(rejectReason)
	if rejectReason == "" {
		return nil, ErrRealnameInvalid
	}
	return uc.repo.Reject(ctx, id, rejectReason, operatorID)
}

func (uc *RealnameUsecase) Delete(ctx context.Context, id, operatorID uint64) error {
	if id == 0 || operatorID == 0 {
		return ErrRealnameInvalid
	}
	return uc.repo.Delete(ctx, id)
}

func MapRealnameError(err error) error {
	if stderrors.Is(err, gorm.ErrRecordNotFound) {
		return ErrRealnameNotFound
	}
	return err
}
