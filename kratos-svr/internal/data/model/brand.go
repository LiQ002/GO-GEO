package model

// Brand is an enterprise brand profile used by generation and GEO analysis.
type Brand struct {
	TenantModel
	Name           string `gorm:"column:name;type:varchar(128);not null;index"`
	AliasesJSON    []byte `gorm:"column:aliases_json;type:json"`
	OfficialDomain string `gorm:"column:official_domain;type:varchar(255);index"`
	Description    string `gorm:"column:description;type:longtext"`
	Industry       string `gorm:"column:industry;type:varchar(128)"`
	Region         string `gorm:"column:region;type:varchar(128)"`
	TargetAudience string `gorm:"column:target_audience;type:text"`
	CoreValue      string `gorm:"column:core_value;type:text"`
	Status         int32  `gorm:"column:status;type:tinyint unsigned;not null;index"`
	Version        uint64 `gorm:"column:version;not null;default:1"`
}

func (Brand) TableName() string { return TableBrands }

// Product is a product or service owned by a brand.
type Product struct {
	TenantModel
	BrandID           uint64 `gorm:"column:brand_id;not null;index"`
	Name              string `gorm:"column:name;type:varchar(255);not null"`
	Description       string `gorm:"column:description;type:longtext"`
	SellingPointsJSON []byte `gorm:"column:selling_points_json;type:json"`
	TargetAudience    string `gorm:"column:target_audience;type:text"`
	Status            string `gorm:"column:status;type:varchar(32);not null"`
}

func (Product) TableName() string { return TableProducts }

// Competitor is an enterprise-scoped competing brand.
type Competitor struct {
	TenantModel
	BrandID     uint64 `gorm:"column:brand_id;not null;index"`
	Name        string `gorm:"column:name;type:varchar(128);not null"`
	AliasesJSON []byte `gorm:"column:aliases_json;type:json"`
	DomainsJSON []byte `gorm:"column:domains_json;type:json"`
	Description string `gorm:"column:description;type:text"`
	Status      string `gorm:"column:status;type:varchar(32);not null"`
}

func (Competitor) TableName() string { return TableCompetitors }

// BrandTerm stores prohibited, preferred, or factual brand expressions.
type BrandTerm struct {
	TenantModel
	BrandID     uint64 `gorm:"column:brand_id;not null;index"`
	TermType    string `gorm:"column:term_type;type:varchar(32);not null;index"`
	Term        string `gorm:"column:term;type:varchar(255);not null"`
	Replacement string `gorm:"column:replacement;type:varchar(255)"`
	Description string `gorm:"column:description;type:varchar(1024)"`
	Enabled     bool   `gorm:"column:enabled;not null;default:true"`
}

func (BrandTerm) TableName() string { return TableBrandTerms }
