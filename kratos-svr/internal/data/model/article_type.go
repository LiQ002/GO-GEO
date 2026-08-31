package model

// ArticleType is the stable, user-visible article template identity.
type ArticleType struct {
	SoftDeleteModel
	Code             string              `gorm:"column:code;type:varchar(64);not null;uniqueIndex"`
	Name             string              `gorm:"column:name;type:varchar(128);not null"`
	Description      string              `gorm:"column:description;type:varchar(1024)"`
	Icon             string              `gorm:"column:icon;type:varchar(255)"`
	SourceType       int32               `gorm:"column:source_type;type:tinyint unsigned;not null;index"`
	Status           int32               `gorm:"column:status;type:tinyint unsigned;not null;index"`
	Visible          bool                `gorm:"column:visible;not null;default:true"`
	SortOrder        int32               `gorm:"column:sort_order;not null;default:0"`
	CurrentVersionID *uint64             `gorm:"column:current_version_id;index"`
	VisibilityJSON   []byte              `gorm:"column:visibility_json;type:json"`
	Version          uint64              `gorm:"column:version;not null;default:1"`
	CurrentVersion   *ArticleTypeVersion `gorm:"-"`
}

func (ArticleType) TableName() string { return TableArticleTypes }

// ArticleTypeVersion is an immutable generation configuration snapshot.
type ArticleTypeVersion struct {
	BaseModel
	ArticleTypeID        uint64                      `gorm:"column:article_type_id;not null;uniqueIndex:uk_cfg_article_type_version,priority:1"`
	VersionNumber        uint32                      `gorm:"column:version_number;not null;uniqueIndex:uk_cfg_article_type_version,priority:2"`
	Status               int32                       `gorm:"column:status;type:tinyint unsigned;not null;index"`
	ContentGoal          string                      `gorm:"column:content_goal;type:text"`
	TargetAudience       string                      `gorm:"column:target_audience;type:text"`
	Tone                 string                      `gorm:"column:tone;type:varchar(128)"`
	RecommendedMinWords  uint32                      `gorm:"column:recommended_min_words;not null;default:0"`
	RecommendedMaxWords  uint32                      `gorm:"column:recommended_max_words;not null;default:0"`
	StructureJSON        []byte                      `gorm:"column:structure_json;type:json;not null"`
	InputSchemaJSON      []byte                      `gorm:"column:input_schema_json;type:json;not null"`
	GEORulesJSON         []byte                      `gorm:"column:geo_rules_json;type:json;not null"`
	QualityRulesJSON     []byte                      `gorm:"column:quality_rules_json;type:json;not null"`
	PromptVersionID      *uint64                     `gorm:"column:prompt_version_id;index"`
	DefaultModelID       *uint64                     `gorm:"column:default_model_id;index"`
	FallbackModelIDsJSON []byte                      `gorm:"column:fallback_model_ids_json;type:json"`
	SystemPrompt         string                      `gorm:"column:system_prompt;type:longtext"`
	UserPromptTemplate   string                      `gorm:"column:user_prompt_template;type:longtext"`
	OutputFormat         int32                       `gorm:"column:output_format;type:tinyint unsigned;not null;default:1"`
	ChangeSummary        string                      `gorm:"column:change_summary;type:varchar(1024)"`
	PublishedBy          *uint64                     `gorm:"column:published_by"`
	Sections             []ArticleTypeSection        `gorm:"foreignKey:ArticleTypeVersionID"`
	InputFields          []ArticleTypeInputField     `gorm:"foreignKey:ArticleTypeVersionID"`
	Rules                []ArticleTypeRule           `gorm:"foreignKey:ArticleTypeVersionID"`
	Models               []ArticleTypeModel          `gorm:"foreignKey:ArticleTypeVersionID"`
	Channels             []ArticleTypeVersionChannel `gorm:"foreignKey:ArticleTypeVersionID"`
}

func (ArticleTypeVersion) TableName() string { return TableArticleTypeVersions }

// ArticleTypeSection stores an ordered article outline item.
type ArticleTypeSection struct {
	BaseModel
	ArticleTypeVersionID uint64 `gorm:"column:article_type_version_id;not null;uniqueIndex:uk_cfg_article_type_section,priority:1"`
	SortOrder            uint32 `gorm:"column:sort_order;not null;uniqueIndex:uk_cfg_article_type_section,priority:2"`
	Title                string `gorm:"column:title;type:varchar(255);not null"`
	Guidance             string `gorm:"column:guidance;type:text"`
	Required             bool   `gorm:"column:required;not null;default:true"`
}

func (ArticleTypeSection) TableName() string { return TableArticleTypeSections }

// ArticleTypeInputField defines one enterprise-provided generation variable.
type ArticleTypeInputField struct {
	BaseModel
	ArticleTypeVersionID uint64                   `gorm:"column:article_type_version_id;not null;uniqueIndex:uk_cfg_article_type_input_key,priority:1"`
	SortOrder            uint32                   `gorm:"column:sort_order;not null;index"`
	FieldKey             string                   `gorm:"column:field_key;type:varchar(64);not null;uniqueIndex:uk_cfg_article_type_input_key,priority:2"`
	Label                string                   `gorm:"column:label;type:varchar(128);not null"`
	InputType            int32                    `gorm:"column:input_type;type:tinyint unsigned;not null"`
	Required             bool                     `gorm:"column:required;not null;default:false"`
	Placeholder          string                   `gorm:"column:placeholder;type:varchar(512)"`
	HelpText             string                   `gorm:"column:help_text;type:varchar(1024)"`
	DefaultValue         string                   `gorm:"column:default_value;type:text"`
	Options              []ArticleTypeInputOption `gorm:"foreignKey:ArticleTypeInputFieldID"`
}

func (ArticleTypeInputField) TableName() string { return TableArticleTypeInputFields }

// ArticleTypeInputOption stores one ordered select option.
type ArticleTypeInputOption struct {
	BaseModel
	ArticleTypeInputFieldID uint64 `gorm:"column:article_type_input_field_id;not null;uniqueIndex:uk_cfg_article_type_input_option,priority:1"`
	SortOrder               uint32 `gorm:"column:sort_order;not null;index"`
	OptionValue             string `gorm:"column:option_value;type:varchar(255);not null;uniqueIndex:uk_cfg_article_type_input_option,priority:2"`
}

func (ArticleTypeInputOption) TableName() string { return TableArticleTypeInputOptions }

// ArticleTypeRule stores an ordered GEO or quality rule.
type ArticleTypeRule struct {
	BaseModel
	ArticleTypeVersionID uint64 `gorm:"column:article_type_version_id;not null;uniqueIndex:uk_cfg_article_type_rule,priority:1"`
	RuleType             int32  `gorm:"column:rule_type;type:tinyint unsigned;not null;uniqueIndex:uk_cfg_article_type_rule,priority:2"`
	SortOrder            uint32 `gorm:"column:sort_order;not null;uniqueIndex:uk_cfg_article_type_rule,priority:3"`
	RuleText             string `gorm:"column:rule_text;type:text;not null"`
}

func (ArticleTypeRule) TableName() string { return TableArticleTypeRules }

// ArticleTypeModel binds an immutable configuration revision to a writing model.
type ArticleTypeModel struct {
	BaseModel
	ArticleTypeVersionID uint64 `gorm:"column:article_type_version_id;not null;uniqueIndex:uk_cfg_article_type_model,priority:1"`
	WritingModelID       uint64 `gorm:"column:writing_model_id;not null;uniqueIndex:uk_cfg_article_type_model,priority:2"`
	IsDefault            bool   `gorm:"column:is_default;not null;default:false"`
	SortOrder            uint32 `gorm:"column:sort_order;not null;index"`
}

func (ArticleTypeModel) TableName() string { return TableArticleTypeModels }

// ArticleTypeVersionChannel binds an immutable configuration revision to an applicable channel.
type ArticleTypeVersionChannel struct {
	BaseModel
	ArticleTypeVersionID uint64 `gorm:"column:article_type_version_id;not null;uniqueIndex:uk_cfg_article_type_version_channel,priority:1"`
	PublishChannelID     uint64 `gorm:"column:publish_channel_id;not null;uniqueIndex:uk_cfg_article_type_version_channel,priority:2"`
	SortOrder            uint32 `gorm:"column:sort_order;not null;index"`
}

func (ArticleTypeVersionChannel) TableName() string { return TableArticleTypeChannels }

const (
	ArticleTypeInputText        int32 = 1
	ArticleTypeInputTextarea    int32 = 2
	ArticleTypeInputNumber      int32 = 3
	ArticleTypeInputSelect      int32 = 4
	ArticleTypeInputMultiSelect int32 = 5

	ArticleTypeRuleGEO     int32 = 1
	ArticleTypeRuleQuality int32 = 2

	ArticleTypeOutputMarkdown int32 = 1
)
