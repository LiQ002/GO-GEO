package model

import "time"

const (
	SalesOpportunityStatusFollowing int32 = 1
	SalesOpportunityStatusPaused    int32 = 2
	SalesOpportunityStatusClosed    int32 = 3
)

// SalesOpportunity stores prospect information required by later GEO diagnoses.
type SalesOpportunity struct {
	SoftDeleteModel
	Code                string     `gorm:"column:code;type:varchar(64);not null;uniqueIndex"`
	Name                string     `gorm:"column:name;type:varchar(128);not null;index"`
	OwnerAdminID        uint64     `gorm:"column:owner_admin_id;not null;index"`
	CustomerName        string     `gorm:"column:customer_name;type:varchar(128);not null;index"`
	Website             string     `gorm:"column:website;type:varchar(512);index"`
	Industry            string     `gorm:"column:industry;type:varchar(128);index"`
	Region              string     `gorm:"column:region;type:varchar(128);index"`
	ContactName         string     `gorm:"column:contact_name;type:varchar(128)"`
	ContactPhone        string     `gorm:"column:contact_phone;type:varchar(64);index"`
	ContactEmail        string     `gorm:"column:contact_email;type:varchar(255);index"`
	BrandName           string     `gorm:"column:brand_name;type:varchar(128);not null;index"`
	TargetAudience      string     `gorm:"column:target_audience;type:text"`
	CoreValue           string     `gorm:"column:core_value;type:text"`
	CurrentContent      string     `gorm:"column:current_content;type:text"`
	PainPoints          string     `gorm:"column:pain_points;type:text"`
	ExpectedGoals       string     `gorm:"column:expected_goals;type:text"`
	BudgetMinMinorUnits int64      `gorm:"column:budget_min_minor_units;not null;default:0"`
	BudgetMaxMinorUnits int64      `gorm:"column:budget_max_minor_units;not null;default:0"`
	Currency            string     `gorm:"column:currency;type:char(3);not null;default:'CNY'"`
	Status              int32      `gorm:"column:status;type:tinyint unsigned;not null;default:1;index"`
	Remark              string     `gorm:"column:remark;type:text"`
	Version             uint64     `gorm:"column:version;not null;default:1"`
	ClosedAt            *time.Time `gorm:"column:closed_at;index"`
}

func (SalesOpportunity) TableName() string { return TableSalesOpportunities }

// SalesOpportunityBrandAlias stores one normalized brand alias.
type SalesOpportunityBrandAlias struct {
	BaseModel
	OpportunityID uint64 `gorm:"column:opportunity_id;not null;index"`
	Alias         string `gorm:"column:alias;type:varchar(128);not null"`
	SortOrder     int32  `gorm:"column:sort_order;not null;default:0"`
}

func (SalesOpportunityBrandAlias) TableName() string { return TableSalesOpportunityAliases }

// SalesOpportunityProduct stores one prospect product or service.
type SalesOpportunityProduct struct {
	BaseModel
	OpportunityID  uint64 `gorm:"column:opportunity_id;not null;index"`
	Name           string `gorm:"column:name;type:varchar(255);not null"`
	Description    string `gorm:"column:description;type:text"`
	SellingPoints  string `gorm:"column:selling_points;type:text"`
	TargetAudience string `gorm:"column:target_audience;type:text"`
	SortOrder      int32  `gorm:"column:sort_order;not null;default:0"`
}

func (SalesOpportunityProduct) TableName() string { return TableSalesOpportunityProducts }

// SalesOpportunityCompetitor stores one competing brand used by diagnosis.
type SalesOpportunityCompetitor struct {
	BaseModel
	OpportunityID uint64 `gorm:"column:opportunity_id;not null;index"`
	Name          string `gorm:"column:name;type:varchar(128);not null"`
	Website       string `gorm:"column:website;type:varchar(512)"`
	Description   string `gorm:"column:description;type:text"`
	SortOrder     int32  `gorm:"column:sort_order;not null;default:0"`
}

func (SalesOpportunityCompetitor) TableName() string { return TableSalesOpportunityCompetitors }
