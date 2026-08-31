package model

// InclusionSite is a browser site used to check GEO visibility.
type InclusionSite struct {
	SoftDeleteModel
	Code               string `gorm:"column:code;type:varchar(64);not null;uniqueIndex"`
	DriverType         int32  `gorm:"column:driver_type;type:tinyint unsigned"`
	Name               string `gorm:"column:name;type:varchar(128);not null"`
	EntryURL           string `gorm:"column:entry_url;type:varchar(1024);not null"`
	LoginURL           string `gorm:"column:login_url;type:varchar(1024)"`
	Icon               string `gorm:"column:icon;type:varchar(512)"`
	Status             int32  `gorm:"column:status;type:tinyint unsigned;not null;index"`
	AuthorizationType  int32  `gorm:"column:authorization_type;type:tinyint unsigned;not null"`
	DriverVersion      string `gorm:"column:driver_version;type:varchar(64)"`
	MaintenanceMessage string `gorm:"column:maintenance_message;type:varchar(1024)"`
	SortOrder          int32  `gorm:"column:sort_order;not null;default:0"`
	Version            uint64 `gorm:"column:version;not null;default:1"`
}

func (InclusionSite) TableName() string { return TableInclusionSites }

// EnterpriseSiteGrant controls per-enterprise site visibility and limits.
type EnterpriseSiteGrant struct {
	TenantModel
	InclusionSiteID uint64 `gorm:"column:inclusion_site_id;not null;uniqueIndex:uk_cfg_enterprise_site,priority:2"`
	Enabled         bool   `gorm:"column:enabled;not null;default:true"`
	DailyLimit      int64  `gorm:"column:daily_limit;not null;default:0"`
	Concurrency     uint32 `gorm:"column:concurrency;not null;default:1"`
}

func (EnterpriseSiteGrant) TableName() string { return TableEnterpriseSiteGrants }
