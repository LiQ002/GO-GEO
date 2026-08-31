package model

// WritingModel is a configured LLM endpoint. Secret material is stored separately.
type WritingModel struct {
	SoftDeleteModel
	Code           string  `gorm:"column:code;type:varchar(64);not null;uniqueIndex"`
	DisplayName    string  `gorm:"column:display_name;type:varchar(128);not null"`
	Provider       int32   `gorm:"column:provider;type:tinyint unsigned;not null;index"`
	Protocol       int32   `gorm:"column:protocol;type:tinyint unsigned;not null"`
	BaseURL        string  `gorm:"column:base_url;type:varchar(512);not null"`
	ModelID        string  `gorm:"column:model_id;type:varchar(128);not null"`
	CredentialRef  string  `gorm:"column:credential_ref;type:varchar(255)"`
	ContextLength  uint32  `gorm:"column:context_length;not null;default:0"`
	Status         int32   `gorm:"column:status;type:tinyint unsigned;not null;index"`
	SortOrder      int32   `gorm:"column:sort_order;not null;default:0"`
	Temperature    float64 `gorm:"column:temperature;type:decimal(4,3);not null;default:0.7"`
	TopP           float64 `gorm:"column:top_p;type:decimal(4,3);not null;default:1"`
	MaxTokens      uint32  `gorm:"column:max_tokens;not null;default:4096"`
	TimeoutSeconds uint32  `gorm:"column:timeout_seconds;not null;default:120"`
	// CitationCapability declares whether the provider returns structured, auditable source metadata.
	CitationCapability int32 `gorm:"column:citation_capability;type:tinyint unsigned;not null;default:1"`
	// DiagnosisAPIMode selects the provider API used only by sales diagnosis calls.
	DiagnosisAPIMode int32 `gorm:"column:diagnosis_api_mode;type:tinyint unsigned;not null;default:1"`
	// DiagnosisWebSearchEnabled enables the provider-native web search tool for diagnosis calls.
	DiagnosisWebSearchEnabled bool `gorm:"column:diagnosis_web_search_enabled;not null;default:false"`

	SafetyEnabled           bool `gorm:"column:safety_enabled;not null;default:false"`
	InputModerationEnabled  bool `gorm:"column:input_moderation_enabled;not null;default:false"`
	OutputModerationEnabled bool `gorm:"column:output_moderation_enabled;not null;default:false"`
	SafetyFailClosed        bool `gorm:"column:safety_fail_closed;not null;default:true"`

	InputPriceMicrosPerMillionTokens  int64  `gorm:"column:input_price_micros_per_million_tokens;not null;default:0"`
	OutputPriceMicrosPerMillionTokens int64  `gorm:"column:output_price_micros_per_million_tokens;not null;default:0"`
	PriceCurrency                     int32  `gorm:"column:price_currency;type:tinyint unsigned;not null;default:1"`
	AccessScope                       int32  `gorm:"column:access_scope;type:tinyint unsigned;not null;default:1;index"`
	Version                           uint64 `gorm:"column:version;not null;default:1"`
}

func (WritingModel) TableName() string { return TableWritingModels }

// WritingModelPurpose identifies a supported generation scenario.
type WritingModelPurpose struct {
	BaseModel
	WritingModelID uint64 `gorm:"column:writing_model_id;not null;uniqueIndex:uk_cfg_writing_model_purpose,priority:1;index"`
	Purpose        int32  `gorm:"column:purpose;type:tinyint unsigned;not null;uniqueIndex:uk_cfg_writing_model_purpose,priority:2"`
}

func (WritingModelPurpose) TableName() string { return TableWritingModelPurposes }

// WritingModelSafetyRule stores a blocked content category for a model.
type WritingModelSafetyRule struct {
	BaseModel
	WritingModelID uint64 `gorm:"column:writing_model_id;not null;uniqueIndex:uk_cfg_writing_model_safety,priority:1;index"`
	Category       int32  `gorm:"column:category;type:tinyint unsigned;not null;uniqueIndex:uk_cfg_writing_model_safety,priority:2"`
}

func (WritingModelSafetyRule) TableName() string { return TableWritingModelSafetyRules }

// WritingModelPlanScope makes a restricted model available to a plan.
type WritingModelPlanScope struct {
	BaseModel
	WritingModelID uint64 `gorm:"column:writing_model_id;not null;uniqueIndex:uk_cfg_writing_model_plan_scope,priority:1;index"`
	PlanID         uint64 `gorm:"column:plan_id;not null;uniqueIndex:uk_cfg_writing_model_plan_scope,priority:2;index"`
}

func (WritingModelPlanScope) TableName() string { return TableWritingModelPlanScopes }

// WritingModelEnterpriseScope makes a restricted model available to one enterprise.
type WritingModelEnterpriseScope struct {
	BaseModel
	WritingModelID uint64 `gorm:"column:writing_model_id;not null;uniqueIndex:uk_cfg_writing_model_enterprise_scope,priority:1;index"`
	EnterpriseID   uint64 `gorm:"column:enterprise_id;not null;uniqueIndex:uk_cfg_writing_model_enterprise_scope,priority:2;index"`
}

func (WritingModelEnterpriseScope) TableName() string { return TableWritingModelEntScopes }

// EnterpriseModelGrant assigns a model configuration to an enterprise.
type EnterpriseModelGrant struct {
	TenantModel
	WritingModelID uint64 `gorm:"column:writing_model_id;not null;uniqueIndex:uk_cfg_enterprise_model,priority:2"`
	Enabled        bool   `gorm:"column:enabled;not null;default:true"`
	IsDefault      bool   `gorm:"column:is_default;not null;default:false"`
	Quota          int64  `gorm:"column:quota;not null;default:0"`
}

func (EnterpriseModelGrant) TableName() string { return TableEnterpriseModelGrants }
