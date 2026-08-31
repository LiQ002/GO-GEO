package model

import "time"

const (
	RealnameTypePersonal  = "personal"
	RealnameTypeEnterprise = "enterprise"

	RealnameStatusPending   = "pending"
	RealnameStatusApproved  = "approved"
	RealnameStatusRejected  = "rejected"
)

type RealnameAuthentication struct {
	TenantModel
	Type              string     `gorm:"column:type;type:varchar(32);not null;index"`
	Status            string     `gorm:"column:status;type:varchar(32);not null;index"`
	RealName          string     `gorm:"column:real_name;type:varchar(128);not null"`
	IDCardNumber      string     `gorm:"column:id_card_number;type:varchar(64);not null"`
	Mobile            string     `gorm:"column:mobile;type:varchar(32);not null"`
	CompanyName       string     `gorm:"column:company_name;type:varchar(255)"`
	RegistrationNo    string     `gorm:"column:registration_no;type:varchar(128)"`
	LicenseImageURL   string     `gorm:"column:license_image_url;type:varchar(1024)"`
	IDCardImageURL    string     `gorm:"column:id_card_image_url;type:varchar(1024)"`
	RejectReason      string     `gorm:"column:reject_reason;type:varchar(512)"`
	ReviewedBy        *uint64    `gorm:"column:reviewed_by;index"`
	ReviewedAt        *time.Time `gorm:"column:reviewed_at"`
	SubmittedAt       time.Time  `gorm:"column:submitted_at;not null;index"`
}

func (RealnameAuthentication) TableName() string { return TableRealnameAuthentications }
