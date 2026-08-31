package model

import "time"

// MonitorPlan schedules repeated GEO checks.
type MonitorPlan struct {
	TenantModel
	Name            string     `gorm:"column:name;type:varchar(255);not null"`
	BrandID         uint64     `gorm:"column:brand_id;not null;index"`
	Status          int32      `gorm:"column:status;type:tinyint unsigned;not null;index"`
	ScheduleType    int32      `gorm:"column:schedule_type;type:tinyint unsigned;not null"`
	MonitorTerminal int32      `gorm:"column:monitor_terminal;type:tinyint unsigned;not null;default:3;comment:监测终端: 1=电脑端 2=移动端 3=并行(PC+移动端)"`
	CronExpression  string     `gorm:"column:cron_expression;type:varchar(128)"`
	Timezone        string     `gorm:"column:timezone;type:varchar(64);not null"`
	QuestionIDsJSON []byte     `gorm:"column:question_ids_json;type:json;not null"`
	SiteTargetsJSON []byte     `gorm:"column:site_targets_json;type:json;not null"`
	NextRunAt       *time.Time `gorm:"column:next_run_at;index"`
	LastRunAt       *time.Time `gorm:"column:last_run_at"`
	ClientRequestID string     `gorm:"column:client_request_id;type:varchar(128);not null;uniqueIndex:uk_geo_plan_request,priority:2"`
	Version         uint64     `gorm:"column:version;not null;default:1"`
}

func (MonitorPlan) TableName() string { return TableMonitorPlans }

// GEOTask is a single question and inclusion-site query.
type GEOTask struct {
	TenantModel
	MonitorPlanID     *uint64    `gorm:"column:monitor_plan_id;index"`
	BrandID           uint64     `gorm:"column:brand_id;not null;index"`
	QuestionID        uint64     `gorm:"column:question_id;not null;index"`
	InclusionSiteID   uint64     `gorm:"column:inclusion_site_id;not null;index"`
	TerminalType      int32      `gorm:"column:terminal_type;type:tinyint unsigned;not null;default:1;index"`
	PlatformAccountID *uint64    `gorm:"column:platform_account_id;index"`
	ModelEntry        string     `gorm:"column:model_entry;type:varchar(128)"`
	Locale            string     `gorm:"column:locale;type:varchar(32)"`
	Region            string     `gorm:"column:region;type:varchar(128)"`
	Status            string     `gorm:"column:status;type:varchar(32);not null;index"`
	Priority          int32      `gorm:"column:priority;not null;default:0;index"`
	ScheduledAt       time.Time  `gorm:"column:scheduled_at;not null;index"`
	AttemptCount      uint32     `gorm:"column:attempt_count;not null;default:0"`
	MaxAttempts       uint32     `gorm:"column:max_attempts;not null;default:3"`
	CurrentLeaseID    *uint64    `gorm:"column:current_lease_id;index"`
	ErrorCategory     string     `gorm:"column:error_category;type:varchar(64);index"`
	ErrorCode         string     `gorm:"column:error_code;type:varchar(64)"`
	ErrorMessage      string     `gorm:"column:error_message;type:text"`
	CompletedAt       *time.Time `gorm:"column:completed_at"`
	Version           uint64     `gorm:"column:version;not null;default:1"`
}

func (GEOTask) TableName() string { return TableGEOTasks }

// AnswerSnapshot preserves raw answer evidence and is never overwritten.
type AnswerSnapshot struct {
	ImmutableTenantModel
	GEOTaskID       uint64    `gorm:"column:geo_task_id;not null;index"`
	AttemptID       uint64    `gorm:"column:attempt_id;not null;index"`
	InclusionSiteID uint64    `gorm:"column:inclusion_site_id;not null"`
	ModelEntry      string    `gorm:"column:model_entry;type:varchar(128)"`
	QuestionText    string    `gorm:"column:question_text;type:text;not null"`
	AnswerText      string    `gorm:"column:answer_text;type:longtext"`
	AnswerStatus    string    `gorm:"column:answer_status;type:varchar(32);not null"`
	ScreenshotKey   string    `gorm:"column:screenshot_key;type:varchar(1024)"`
	EvidenceJSON    []byte    `gorm:"column:evidence_json;type:json"`
	// SessionRef 对话分享链接，部分平台（如文心一言）URL 可达 600+ 字符。
	// 注意：varchar(2048) 在 utf8mb4 下占 8192 字节，超过 MySQL 单列索引限制
	// （767 字节/5.7 或 3072 字节/8.0+large_prefix）。如需按 session_ref 加索引，
	// 必须用前缀索引：INDEX(session_ref(768))
	SessionRef      string    `gorm:"column:session_ref;type:varchar(2048)"`
	ObservedAt      time.Time `gorm:"column:observed_at;not null;index"`
	ContentHash     string    `gorm:"column:content_hash;type:char(64);not null"`
	ClientVersion   string    `gorm:"column:client_version;type:varchar(64)"`
}

func (AnswerSnapshot) TableName() string { return TableAnswerSnapshots }

// Citation is a normalized source cited by an answer.
type Citation struct {
	ImmutableTenantModel
	AnswerSnapshotID   uint64  `gorm:"column:answer_snapshot_id;not null;index"`
	// URL varchar(8192)：Kimi 等平台引用带 #:~:text= STTF fragment 可达 KB 级。
	// 双保险：前端 stripUrlFragment 剥离 + 后端 truncateCitationURL 兜底截断。
	URL                string  `gorm:"column:url;type:varchar(8192);not null"`
	Domain             string  `gorm:"column:domain;type:varchar(255);not null;index"`
	Title              string  `gorm:"column:title;type:varchar(1024)"`
	Position           uint32  `gorm:"column:position;not null;default:0"`
	IsEnterpriseSource bool    `gorm:"column:is_enterprise_source;not null;default:false"`
	ArticleID          *uint64 `gorm:"column:article_id;index"`
	MetadataJSON       []byte  `gorm:"column:metadata_json;type:json"`
}

func (Citation) TableName() string { return TableCitations }

// Mention is a brand or competitor occurrence extracted from an answer.
type Mention struct {
	ImmutableTenantModel
	AnswerSnapshotID uint64  `gorm:"column:answer_snapshot_id;not null;index"`
	EntityType       string  `gorm:"column:entity_type;type:varchar(32);not null"`
	EntityID         uint64  `gorm:"column:entity_id;not null;index"`
	Text             string  `gorm:"column:text;type:text;not null"`
	Position         uint32  `gorm:"column:position;not null;default:0"`
	Rank             uint32  `gorm:"column:mention_rank;not null;default:0"`
	Sentiment        string  `gorm:"column:sentiment;type:varchar(32)"`
	Confidence       float64 `gorm:"column:confidence;type:decimal(6,5);not null;default:0"`
}

func (Mention) TableName() string { return TableMentions }

// AnalysisResult is versioned structured analysis of an immutable answer.
type AnalysisResult struct {
	ImmutableTenantModel
	AnswerSnapshotID uint64  `gorm:"column:answer_snapshot_id;not null;index"`
	AnalysisVersion  uint32  `gorm:"column:analysis_version;not null"`
	RuleVersion      string  `gorm:"column:rule_version;type:varchar(64);not null"`
	WritingModelID   *uint64 `gorm:"column:writing_model_id"`
	Status           string  `gorm:"column:status;type:varchar(32);not null;index"`
	BrandMentioned   bool    `gorm:"column:brand_mentioned;not null;default:false"`
	EnterpriseCited  bool    `gorm:"column:enterprise_cited;not null;default:false"`
	VisibilityScore  float64 `gorm:"column:visibility_score;type:decimal(8,4);not null;default:0"`
	AccuracyScore    float64 `gorm:"column:accuracy_score;type:decimal(8,4);not null;default:0"`
	Confidence       float64 `gorm:"column:confidence;type:decimal(6,5);not null;default:0"`
	ResultJSON       []byte  `gorm:"column:result_json;type:json;not null"`
}

func (AnalysisResult) TableName() string { return TableAnalysisResults }

// ManualReview preserves a human correction without changing raw evidence.
type ManualReview struct {
	ImmutableTenantModel
	AnswerSnapshotID uint64  `gorm:"column:answer_snapshot_id;not null;index"`
	AnalysisResultID *uint64 `gorm:"column:analysis_result_id;index"`
	ReviewerID       uint64  `gorm:"column:reviewer_id;not null"`
	BeforeJSON       []byte  `gorm:"column:before_json;type:json"`
	AfterJSON        []byte  `gorm:"column:after_json;type:json;not null"`
	Reason           string  `gorm:"column:reason;type:text;not null"`
}

func (ManualReview) TableName() string { return TableManualReviews }

// OpinionSummary is a LLM-generated periodic opinion report row.
// One row per (enterprise, brand, period, category); unique key keeps the
// scheduler idempotent — re-running a cycle never duplicates rows.
type OpinionSummary struct {
	ImmutableTenantModel
	BrandID      uint64    `gorm:"column:brand_id;not null"`
	PeriodType   string    `gorm:"column:period_type;type:varchar(16);not null"`
	PeriodKey    string    `gorm:"column:period_key;type:varchar(16);not null"`
	PeriodStart  time.Time `gorm:"column:period_start;type:date;not null"`
	PeriodEnd    time.Time `gorm:"column:period_end;type:date;not null"`
	Category     string    `gorm:"column:category;type:varchar(32);not null"`
	Sentiment    string    `gorm:"column:sentiment;type:varchar(16);not null;default:'neutral'"`
	Content      string    `gorm:"column:content;type:mediumtext;not null"`
	MentionCount uint32    `gorm:"column:mention_count;type:int unsigned;not null;default:0"`
	LLMModelID   *uint64   `gorm:"column:llm_model_id"`
	Status       string    `gorm:"column:status;type:varchar(16);not null;default:'completed'"`
	GeneratedAt  time.Time `gorm:"column:generated_at;not null"`
}

func (OpinionSummary) TableName() string { return TableOpinionSummaries }
