package model

// PublishChannel describes a self-media, official-media, or KOL channel family.
type PublishChannel struct {
	SoftDeleteModel
	Code              string `gorm:"column:code;type:varchar(64);not null;uniqueIndex"`
	DriverType        int32  `gorm:"column:driver_type;type:tinyint unsigned"`
	LoginURL          string `gorm:"column:login_url;type:varchar(1024)"`
	Name              string `gorm:"column:name;type:varchar(128);not null"`
	Category          int32  `gorm:"column:category;type:tinyint unsigned;not null;index"`
	Icon              string `gorm:"column:icon;type:varchar(512)"`
	Description       string `gorm:"column:description;type:varchar(1024)"`
	Status            int32  `gorm:"column:status;type:tinyint unsigned;not null;index"`
	AuthorizationType int32  `gorm:"column:authorization_type;type:tinyint unsigned;not null"`
	ExecutionMode     int32  `gorm:"column:execution_mode;type:tinyint unsigned;not null"`
	DriverVersion     string `gorm:"column:driver_version;type:varchar(64)"`
	SortOrder         int32  `gorm:"column:sort_order;not null;default:0"`
	Version           uint64 `gorm:"column:version;not null;default:1"`
}

func (PublishChannel) TableName() string { return TablePublishChannels }

// PublishTarget is a concrete official media column or KOL submission target.
type PublishTarget struct {
	SoftDeleteModel
	PublishChannelID uint64 `gorm:"column:publish_channel_id;not null;index"`
	Name             string `gorm:"column:name;type:varchar(255);not null"`
	TargetType       int32  `gorm:"column:target_type;type:tinyint unsigned;not null;index"`
	Platform         string `gorm:"column:platform;type:varchar(128)"`
	EntryURL         string `gorm:"column:entry_url;type:varchar(1024)"`
	SubmissionEmail  string `gorm:"column:submission_email;type:varchar(255)"`
	Region           string `gorm:"column:region;type:varchar(128)"`
	Industry         string `gorm:"column:industry;type:varchar(128)"`
	ContactEnvelope  []byte `gorm:"column:contact_envelope;type:blob"`
	CooperationJSON  []byte `gorm:"column:cooperation_json;type:json"`
	RequirementsJSON []byte `gorm:"column:requirements_json;type:json"`
	Status           int32  `gorm:"column:status;type:tinyint unsigned;not null;index"`
	SortOrder        int32  `gorm:"column:sort_order;not null;default:0"`
	Version          uint64 `gorm:"column:version;not null;default:1"`
}

func (PublishTarget) TableName() string { return TablePublishTargets }

// EnterpriseChannelGrant controls per-enterprise channel visibility.
type EnterpriseChannelGrant struct {
	TenantModel
	PublishChannelID uint64 `gorm:"column:publish_channel_id;not null;uniqueIndex:uk_cfg_enterprise_channel,priority:2"`
	Enabled          bool   `gorm:"column:enabled;not null;default:true"`
	DailyLimit       int64  `gorm:"column:daily_limit;not null;default:0"`
}

func (EnterpriseChannelGrant) TableName() string { return TableEnterpriseChannelGrants }
