package model

import "time"

// PublishPlan 投放计划——纯容器，不再强制绑定单篇文章。
// 文章信息下沉到 pub_tasks，一个 plan 可包含多篇文章 × 多平台的 tasks。
type PublishPlan struct {
	TenantModel
	Name              string     `gorm:"column:name;type:varchar(255);not null"`
	ArticleID         *uint64    `gorm:"column:article_id;index"` // 保留字段，新计划置 NULL；历史兼容
	ArticleSnapshotID *uint64    `gorm:"column:article_snapshot_id"`
	Status            int32      `gorm:"column:status;type:tinyint unsigned;not null;index"`
	ScheduleType      int32      `gorm:"column:schedule_type;type:tinyint unsigned;not null"`
	ScheduledAt       *time.Time `gorm:"column:scheduled_at;index"`
	Timezone          string     `gorm:"column:timezone;type:varchar(64);not null"`
	FailurePolicyJSON []byte     `gorm:"column:failure_policy_json;type:json"`
	DedupStrategy     string     `gorm:"column:dedup_strategy;type:varchar(32);not null;default:'no_dedup'"`
	ClientRequestID   string     `gorm:"column:client_request_id;type:varchar(128);not null;uniqueIndex:uk_pub_plan_request,priority:2"`
	Version           uint64     `gorm:"column:version;not null;default:1"`
}

func (PublishPlan) TableName() string { return TablePublishPlans }

// PublishTask is a single target delivery unit.
type PublishTask struct {
	TenantModel
	PublishPlanID     uint64     `gorm:"column:publish_plan_id;not null;index"`
	ArticleID         uint64     `gorm:"column:article_id;not null;default:0;index:idx_pub_task_article,priority:2"`
	ArticleSnapshotID uint64     `gorm:"column:article_snapshot_id;not null"`
	PublishChannelID  uint64     `gorm:"column:publish_channel_id;not null;index:idx_pub_task_article,priority:3"`
	PublishTargetID   *uint64    `gorm:"column:publish_target_id;index"`
	PlatformAccountID *uint64    `gorm:"column:platform_account_id;index"`
	ExecutionMode     string     `gorm:"column:execution_mode;type:varchar(32);not null"`
	Status            string     `gorm:"column:status;type:varchar(32);not null;index"`
	Priority          int32      `gorm:"column:priority;not null;default:0;index"`
	ScheduledAt       time.Time  `gorm:"column:scheduled_at;not null;index"`
	NextRetryAt       *time.Time `gorm:"column:next_retry_at;index"`
	AttemptCount      uint32     `gorm:"column:attempt_count;not null;default:0"`
	MaxAttempts       uint32     `gorm:"column:max_attempts;not null;default:3"`
	CurrentLeaseID    *uint64    `gorm:"column:current_lease_id;index"`
	ResultURL         string     `gorm:"column:result_url;type:varchar(2048)"`
	PlatformArticleID string     `gorm:"column:platform_article_id;type:varchar(255)"`
	ErrorCategory     string     `gorm:"column:error_category;type:varchar(64);index"`
	ErrorCode         string     `gorm:"column:error_code;type:varchar(64)"`
	ErrorMessage      string     `gorm:"column:error_message;type:text"`
	CompletedAt       *time.Time `gorm:"column:completed_at"`
	Version           uint64     `gorm:"column:version;not null;default:1"`
}

func (PublishTask) TableName() string { return TablePublishTasks }

// PublishAttempt is an append-only execution attempt.
type PublishAttempt struct {
	ImmutableTenantModel
	PublishTaskID  uint64     `gorm:"column:publish_task_id;not null;index"`
	AttemptNumber  uint32     `gorm:"column:attempt_number;not null"`
	WorkerNodeID   uint64     `gorm:"column:worker_node_id;not null;index"`
	LeaseID        uint64     `gorm:"column:lease_id;not null;index"`
	IdempotencyKey string     `gorm:"column:idempotency_key;type:varchar(128);not null;uniqueIndex"`
	Status         string     `gorm:"column:status;type:varchar(32);not null;index"`
	StartedAt      time.Time  `gorm:"column:started_at;not null"`
	FinishedAt     *time.Time `gorm:"column:finished_at"`
	DurationMS     uint64     `gorm:"column:duration_ms;not null;default:0"`
	ResultJSON     []byte     `gorm:"column:result_json;type:json"`
	EvidenceJSON   []byte     `gorm:"column:evidence_json;type:json"`
	ErrorCategory  string     `gorm:"column:error_category;type:varchar(64);index"`
	ErrorCode      string     `gorm:"column:error_code;type:varchar(64)"`
	ErrorMessage   string     `gorm:"column:error_message;type:text"`
	ClientVersion  string     `gorm:"column:client_version;type:varchar(64)"`
}

func (PublishAttempt) TableName() string { return TablePublishAttempts }

// SubmissionReceipt stores official-media or KOL follow-up state.
type SubmissionReceipt struct {
	TenantModel
	PublishTaskID  uint64     `gorm:"column:publish_task_id;not null;index"`
	ReceiptType    string     `gorm:"column:receipt_type;type:varchar(32);not null"`
	ReceiptCode    string     `gorm:"column:receipt_code;type:varchar(255);index"`
	Status         string     `gorm:"column:status;type:varchar(32);not null;index"`
	SubmittedAt    *time.Time `gorm:"column:submitted_at"`
	ExpectedAt     *time.Time `gorm:"column:expected_at"`
	PublishedAt    *time.Time `gorm:"column:published_at"`
	PublishedURL   string     `gorm:"column:published_url;type:varchar(2048)"`
	CostMinorUnits int64      `gorm:"column:cost_minor_units;not null;default:0"`
	Currency       string     `gorm:"column:currency;type:char(3)"`
	FollowUpJSON   []byte     `gorm:"column:follow_up_json;type:json"`
}

func (SubmissionReceipt) TableName() string { return TableSubmissionReceipts }
