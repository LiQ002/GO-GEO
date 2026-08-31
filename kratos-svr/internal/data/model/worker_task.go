package model

import "time"

// WorkerNode is a separately authenticated operator execution device.
type WorkerNode struct {
	SoftDeleteModel
	NodeID             string     `gorm:"column:node_id;type:varchar(128);not null;uniqueIndex"`
	Name               string     `gorm:"column:name;type:varchar(128);not null"`
	Status             string     `gorm:"column:status;type:varchar(32);not null;index"`
	ApprovalStatus     string     `gorm:"column:approval_status;type:varchar(32);not null;index"`
	CredentialHash     string     `gorm:"column:credential_hash;type:char(64);not null"`
	ClientVersion      string     `gorm:"column:client_version;type:varchar(64);not null"`
	DriverVersionsJSON []byte     `gorm:"column:driver_versions_json;type:json"`
	CapabilitiesJSON   []byte     `gorm:"column:capabilities_json;type:json;not null"`
	SystemInfoJSON     []byte     `gorm:"column:system_info_json;type:json"`
	MaxConcurrency     uint32     `gorm:"column:max_concurrency;not null;default:1"`
	LastHeartbeatAt    *time.Time `gorm:"column:last_heartbeat_at;index"`
	RevokedAt          *time.Time `gorm:"column:revoked_at"`
	Version            uint64     `gorm:"column:version;not null;default:1"`
}

func (WorkerNode) TableName() string { return TableWorkerNodes }

// TaskLease serializes task ownership across worker nodes.
type TaskLease struct {
	BaseModel
	TaskType       string     `gorm:"column:task_type;type:varchar(32);not null;uniqueIndex:uk_wrk_active_lease,priority:1"`
	TaskID         uint64     `gorm:"column:task_id;not null;uniqueIndex:uk_wrk_active_lease,priority:2"`
	WorkerNodeID   uint64     `gorm:"column:worker_node_id;not null;index"`
	LeaseTokenHash string     `gorm:"column:lease_token_hash;type:char(64);not null;uniqueIndex"`
	Status         string     `gorm:"column:status;type:varchar(32);not null;index"`
	LeaseVersion   uint64     `gorm:"column:lease_version;not null;default:1"`
	LeasedAt       time.Time  `gorm:"column:leased_at;not null"`
	ExpiresAt      time.Time  `gorm:"column:expires_at;not null;index"`
	ReleasedAt     *time.Time `gorm:"column:released_at"`
	ReleaseReason  string     `gorm:"column:release_reason;type:varchar(255)"`
}

func (TaskLease) TableName() string { return TableTaskLeases }

// WorkerHeartbeat is append-only operational telemetry.
type WorkerHeartbeat struct {
	BaseModel
	WorkerNodeID uint64    `gorm:"column:worker_node_id;not null;index"`
	ActiveTasks  uint32    `gorm:"column:active_tasks;not null;default:0"`
	MetricsJSON  []byte    `gorm:"column:metrics_json;type:json"`
	ReceivedAt   time.Time `gorm:"column:received_at;not null;index"`
}

func (WorkerHeartbeat) TableName() string { return TableWorkerHeartbeats }
