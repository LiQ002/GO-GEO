package model

// PromptTemplate groups immutable prompt versions by purpose.
type PromptTemplate struct {
	SoftDeleteModel
	Code             string  `gorm:"column:code;type:varchar(64);not null;uniqueIndex"`
	Name             string  `gorm:"column:name;type:varchar(128);not null"`
	Purpose          string  `gorm:"column:purpose;type:varchar(64);not null;index"`
	Description      string  `gorm:"column:description;type:varchar(1024)"`
	Status           string  `gorm:"column:status;type:varchar(32);not null"`
	CurrentVersionID *uint64 `gorm:"column:current_version_id;index"`
	Version          uint64  `gorm:"column:version;not null;default:1"`
}

func (PromptTemplate) TableName() string { return TablePromptTemplates }

// PromptVersion is immutable after publication.
type PromptVersion struct {
	BaseModel
	PromptTemplateID uint64  `gorm:"column:prompt_template_id;not null;uniqueIndex:uk_cfg_prompt_version,priority:1"`
	VersionNumber    uint32  `gorm:"column:version_number;not null;uniqueIndex:uk_cfg_prompt_version,priority:2"`
	Status           string  `gorm:"column:status;type:varchar(32);not null"`
	SystemPrompt     string  `gorm:"column:system_prompt;type:longtext;not null"`
	Template         string  `gorm:"column:template;type:longtext;not null"`
	VariablesJSON    []byte  `gorm:"column:variables_json;type:json;not null"`
	OutputSchemaJSON []byte  `gorm:"column:output_schema_json;type:json"`
	Checksum         string  `gorm:"column:checksum;type:char(64);not null"`
	ChangeSummary    string  `gorm:"column:change_summary;type:varchar(1024)"`
	PublishedBy      *uint64 `gorm:"column:published_by"`
}

func (PromptVersion) TableName() string { return TablePromptVersions }
