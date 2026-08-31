package model

import "time"

// Keyword is an enterprise content and monitoring keyword.
type Keyword struct {
	TenantModel
	BrandID                uint64  `gorm:"column:brand_id;not null;index"`
	Text                   string  `gorm:"column:text;type:varchar(255);not null;index"`
	Region                 string  `gorm:"column:region;type:varchar(128)"`
	TagsJSON               []byte  `gorm:"column:tags_json;type:json"`
	Priority               int32   `gorm:"column:priority;not null;default:0"`
	RequestedQuestionCount uint32  `gorm:"column:requested_question_count;not null;default:0"`
	DistilledQuestionCount uint32  `gorm:"column:distilled_question_count;not null;default:0"`
	DistillationStatus     int32   `gorm:"column:distillation_status;type:tinyint unsigned;not null;default:1;index"`
	LastDistillationTaskID *uint64 `gorm:"column:last_distillation_task_id"`
	DistillationError      string  `gorm:"column:distillation_error;type:text"`
	Status                 string  `gorm:"column:status;type:varchar(32);not null;index"`
	Source                 string  `gorm:"column:source;type:varchar(32);not null"`
	Version                uint64  `gorm:"column:version;not null;default:1"`
}

func (Keyword) TableName() string { return TableKeywords }

// KeywordDistillationTask tracks one reproducible Eino question generation run.
type KeywordDistillationTask struct {
	TenantModel
	KeywordID           uint64     `gorm:"column:keyword_id;not null;index"`
	BrandID             uint64     `gorm:"column:brand_id;not null;index"`
	WritingModelID      uint64     `gorm:"column:writing_model_id;not null;index"`
	WritingModelVersion uint64     `gorm:"column:writing_model_version;not null"`
	ClientRequestID     string     `gorm:"column:client_request_id;type:varchar(128);not null;index"`
	Status              int32      `gorm:"column:status;type:tinyint unsigned;not null;index"`
	Region              string     `gorm:"column:region;type:varchar(128)"`
	RequestedCount      uint32     `gorm:"column:requested_count;not null"`
	PromptSnapshot      string     `gorm:"column:prompt_snapshot;type:longtext;not null"`
	ModelSnapshotJSON   []byte     `gorm:"column:model_snapshot_json;type:json;not null"`
	OutputJSON          []byte     `gorm:"column:output_json;type:json"`
	InputTokens         uint64     `gorm:"column:input_tokens;not null;default:0"`
	OutputTokens        uint64     `gorm:"column:output_tokens;not null;default:0"`
	CostMicros          int64      `gorm:"column:cost_micros;not null;default:0"`
	ErrorCode           string     `gorm:"column:error_code;type:varchar(64)"`
	ErrorMessage        string     `gorm:"column:error_message;type:text"`
	AttemptCount        uint32     `gorm:"column:attempt_count;not null;default:0"`
	StartedAt           *time.Time `gorm:"column:started_at"`
	CompletedAt         *time.Time `gorm:"column:completed_at"`
}

func (KeywordDistillationTask) TableName() string { return TableKeywordDistillationTasks }

// Question is a confirmed or candidate standard question.
type Question struct {
	TenantModel
	KeywordID          uint64  `gorm:"column:keyword_id;not null;index"`
	BrandID            uint64  `gorm:"column:brand_id;not null;index"`
	Text               string  `gorm:"column:text;type:text;not null"`
	Region             string  `gorm:"column:region;type:varchar(128)"`
	Source             int32   `gorm:"column:source;type:tinyint unsigned;not null;default:1"`
	DistillationTaskID *uint64 `gorm:"column:distillation_task_id;index"`
	Status             int32   `gorm:"column:status;type:tinyint unsigned;not null;index"`
	Intent             int32   `gorm:"column:intent;type:tinyint unsigned;not null;index"`
	Audience           string  `gorm:"column:audience;type:varchar(128)"`
	FunnelStage        int32   `gorm:"column:funnel_stage;type:tinyint unsigned;not null"`
	ClusterCode        string  `gorm:"column:cluster_code;type:varchar(128);index"`
	Priority           int32   `gorm:"column:priority;not null;default:0"`
	SortOrder          int32   `gorm:"column:sort_order;not null;default:0"`
	Version            uint64  `gorm:"column:version;not null;default:1"`
}

func (Question) TableName() string { return TableQuestions }

// QuestionVersion preserves generated and reviewed question changes.
type QuestionVersion struct {
	ImmutableTenantModel
	QuestionID    uint64 `gorm:"column:question_id;not null;index"`
	VersionNumber uint32 `gorm:"column:version_number;not null"`
	Text          string `gorm:"column:text;type:text;not null"`
	MetadataJSON  []byte `gorm:"column:metadata_json;type:json"`
	OperatorType  string `gorm:"column:operator_type;type:varchar(32);not null"`
	OperatorID    uint64 `gorm:"column:operator_id;not null"`
	Reason        string `gorm:"column:reason;type:varchar(512)"`
}

func (QuestionVersion) TableName() string { return TableQuestionVersions }
