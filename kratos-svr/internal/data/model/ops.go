package model

import "time"

// SystemSetting is a versioned non-secret platform setting.
type SystemSetting struct {
	SoftDeleteModel
	Namespace   string `gorm:"column:namespace;type:varchar(64);not null;uniqueIndex:uk_cfg_setting,priority:1"`
	Key         string `gorm:"column:key_name;type:varchar(128);not null;uniqueIndex:uk_cfg_setting,priority:2"`
	ValueJSON   []byte `gorm:"column:value_json;type:json;not null"`
	Description string `gorm:"column:description;type:varchar(1024)"`
	Sensitive   bool   `gorm:"column:is_sensitive;not null;default:false"`
	Version     uint64 `gorm:"column:version;not null;default:1"`
}

func (SystemSetting) TableName() string { return TableSystemSettings }

// AuditLog is an immutable operation and security audit record.
type AuditLog struct {
	ID           uint64    `gorm:"column:id;primaryKey;autoIncrement"`
	EnterpriseID *uint64   `gorm:"column:enterprise_id;index"`
	ActorType    string    `gorm:"column:actor_type;type:varchar(32);not null;index"`
	ActorID      uint64    `gorm:"column:actor_id;not null;index"`
	Audience     string    `gorm:"column:audience;type:varchar(32);not null"`
	Action       string    `gorm:"column:action;type:varchar(128);not null;index"`
	ResourceType string    `gorm:"column:resource_type;type:varchar(64);not null;index"`
	ResourceID   string    `gorm:"column:resource_id;type:varchar(128);not null"`
	Result       string    `gorm:"column:result;type:varchar(32);not null"`
	Reason       string    `gorm:"column:reason;type:varchar(1024)"`
	BeforeJSON   []byte    `gorm:"column:before_json;type:json"`
	AfterJSON    []byte    `gorm:"column:after_json;type:json"`
	IPAddress    string    `gorm:"column:ip_address;type:varchar(64)"`
	UserAgent    string    `gorm:"column:user_agent;type:varchar(512)"`
	RequestID    string    `gorm:"column:request_id;type:varchar(128);index"`
	TraceID      string    `gorm:"column:trace_id;type:varchar(128);index"`
	CreatedAt    time.Time `gorm:"column:created_at;not null;index"`
}

func (AuditLog) TableName() string { return TableAuditLogs }

// Notification is an enterprise or operator notification.
type Notification struct {
	BaseModel
	EnterpriseID  *uint64    `gorm:"column:enterprise_id;index"`
	RecipientType string     `gorm:"column:recipient_type;type:varchar(32);not null"`
	RecipientID   uint64     `gorm:"column:recipient_id;not null;index"`
	Channel       string     `gorm:"column:channel;type:varchar(32);not null"`
	TemplateCode  string     `gorm:"column:template_code;type:varchar(64);not null"`
	PayloadJSON   []byte     `gorm:"column:payload_json;type:json;not null"`
	Status        string     `gorm:"column:status;type:varchar(32);not null;index"`
	ScheduledAt   time.Time  `gorm:"column:scheduled_at;not null;index"`
	SentAt        *time.Time `gorm:"column:sent_at"`
	ReadAt        *time.Time `gorm:"column:read_at;index"`
	ErrorMessage  string     `gorm:"column:error_message;type:text"`
}

func (Notification) TableName() string { return TableNotifications }

// Alert is an operational alert lifecycle.
type Alert struct {
	BaseModel
	EnterpriseID *uint64    `gorm:"column:enterprise_id;index"`
	AlertType    string     `gorm:"column:alert_type;type:varchar(64);not null;index"`
	Severity     string     `gorm:"column:severity;type:varchar(16);not null;index"`
	Status       string     `gorm:"column:status;type:varchar(32);not null;index"`
	Title        string     `gorm:"column:title;type:varchar(255);not null"`
	Description  string     `gorm:"column:description;type:text"`
	ResourceType string     `gorm:"column:resource_type;type:varchar(64)"`
	ResourceID   string     `gorm:"column:resource_id;type:varchar(128)"`
	DetailsJSON  []byte     `gorm:"column:details_json;type:json"`
	ResolvedAt   *time.Time `gorm:"column:resolved_at"`
	ResolvedBy   *uint64    `gorm:"column:resolved_by"`
}

func (Alert) TableName() string { return TableAlerts }

// OutboxEvent is committed with state changes and delivered asynchronously.
type OutboxEvent struct {
	BaseModel
	AggregateType  string     `gorm:"column:aggregate_type;type:varchar(64);not null;index"`
	AggregateID    string     `gorm:"column:aggregate_id;type:varchar(128);not null;index"`
	EventType      string     `gorm:"column:event_type;type:varchar(128);not null;index"`
	PayloadJSON    []byte     `gorm:"column:payload_json;type:json;not null"`
	IdempotencyKey string     `gorm:"column:idempotency_key;type:varchar(128);not null;uniqueIndex"`
	Status         string     `gorm:"column:status;type:varchar(32);not null;index"`
	AvailableAt    time.Time  `gorm:"column:available_at;not null;index"`
	PublishedAt    *time.Time `gorm:"column:published_at"`
	AttemptCount   uint32     `gorm:"column:attempt_count;not null;default:0"`
	LastError      string     `gorm:"column:last_error;type:text"`
}

func (OutboxEvent) TableName() string { return TableOutboxEvents }

// ExportJob represents a tenant-scoped or audited cross-tenant export.
type ExportJob struct {
	BaseModel
	EnterpriseID    *uint64    `gorm:"column:enterprise_id;index;uniqueIndex:uk_ops_export_request,priority:1"`
	RequestedByType string     `gorm:"column:requested_by_type;type:varchar(32);not null"`
	RequestedByID   uint64     `gorm:"column:requested_by_id;not null"`
	ResourceType    string     `gorm:"column:resource_type;type:varchar(64);not null"`
	Format          string     `gorm:"column:format;type:varchar(16);not null"`
	FilterJSON      []byte     `gorm:"column:filter_json;type:json;not null"`
	ClientRequestID string     `gorm:"column:client_request_id;type:varchar(128);not null;uniqueIndex:uk_ops_export_request,priority:2"`
	Status          string     `gorm:"column:status;type:varchar(32);not null;index"`
	ObjectKey       string     `gorm:"column:object_key;type:varchar(1024)"`
	FileHash        string     `gorm:"column:file_hash;type:char(64)"`
	ExpiresAt       *time.Time `gorm:"column:expires_at"`
	ErrorMessage    string     `gorm:"column:error_message;type:text"`
	CompletedAt     *time.Time `gorm:"column:completed_at"`
	CancelledAt     *time.Time `gorm:"column:cancelled_at"`
}

func (ExportJob) TableName() string { return TableExportJobs }
