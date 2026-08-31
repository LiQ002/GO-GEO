package model

import (
	"time"

	"gorm.io/gorm"
)

// AuthorizationAccountID allocates globally unique IDs shared by both authorization domains.
type AuthorizationAccountID struct {
	ID           uint64    `gorm:"column:id;primaryKey;autoIncrement"`
	ResourceType int32     `gorm:"column:resource_type;type:tinyint unsigned;not null;index"`
	CreatedAt    time.Time `gorm:"column:created_at;not null"`
}

func (AuthorizationAccountID) TableName() string { return TableAuthorizationAccountIDs }

// SelfMediaAuthorization stores an enterprise-owned self-media login authorization.
type SelfMediaAuthorization struct {
	ID                  uint64         `gorm:"column:id;primaryKey;autoIncrement:false"`
	EnterpriseID        uint64         `gorm:"column:enterprise_id;not null;index"`
	PublishChannelID    uint64         `gorm:"column:publish_channel_id;not null;index"`
	AccountName         string         `gorm:"column:account_name;type:varchar(255);not null"`
	ExternalID          string         `gorm:"column:external_id;type:varchar(255);index"`
	MaskedIdentity      string         `gorm:"column:masked_identity;type:varchar(255)"`
	AuthorizationStatus int32          `gorm:"column:authorization_status;type:tinyint unsigned;not null;index"`
	UsageStatus         int32          `gorm:"column:usage_status;type:tinyint unsigned;not null;index"`
	ExpiresAt           *time.Time     `gorm:"column:expires_at;index"`
	LastVerifiedAt      *time.Time     `gorm:"column:last_verified_at"`
	LastUsedAt          *time.Time     `gorm:"column:last_used_at"`
	DailyLimit          int64          `gorm:"column:daily_limit;not null;default:0"`
	IsDefault           bool           `gorm:"column:is_default;not null;default:false"`
	MetadataJSON        []byte         `gorm:"column:metadata_json;type:json"`
	Version             uint64         `gorm:"column:version;not null;default:1"`
	CreatedAt           time.Time      `gorm:"column:created_at;not null"`
	UpdatedAt           time.Time      `gorm:"column:updated_at;not null"`
	DeletedAt           gorm.DeletedAt `gorm:"column:deleted_at;index"`
}

func (SelfMediaAuthorization) TableName() string { return TableSelfMediaAuthorizations }

// InclusionSiteAuthorization stores an enterprise-owned GEO site login authorization.
type InclusionSiteAuthorization struct {
	ID                  uint64         `gorm:"column:id;primaryKey;autoIncrement:false"`
	EnterpriseID        uint64         `gorm:"column:enterprise_id;not null;index"`
	InclusionSiteID     uint64         `gorm:"column:inclusion_site_id;not null;index"`
	AccountName         string         `gorm:"column:account_name;type:varchar(255);not null"`
	ExternalID          string         `gorm:"column:external_id;type:varchar(255);index"`
	MaskedIdentity      string         `gorm:"column:masked_identity;type:varchar(255)"`
	AuthorizationStatus int32          `gorm:"column:authorization_status;type:tinyint unsigned;not null;index"`
	UsageStatus         int32          `gorm:"column:usage_status;type:tinyint unsigned;not null;index"`
	ExpiresAt           *time.Time     `gorm:"column:expires_at;index"`
	LastVerifiedAt      *time.Time     `gorm:"column:last_verified_at"`
	LastUsedAt          *time.Time     `gorm:"column:last_used_at"`
	DailyLimit          int64          `gorm:"column:daily_limit;not null;default:0"`
	IsDefault           bool           `gorm:"column:is_default;not null;default:false"`
	MetadataJSON        []byte         `gorm:"column:metadata_json;type:json"`
	Version             uint64         `gorm:"column:version;not null;default:1"`
	CreatedAt           time.Time      `gorm:"column:created_at;not null"`
	UpdatedAt           time.Time      `gorm:"column:updated_at;not null"`
	DeletedAt           gorm.DeletedAt `gorm:"column:deleted_at;index"`
}

func (InclusionSiteAuthorization) TableName() string { return TableInclusionAuthorizations }

// CredentialEnvelope stores an opaque credential payload encrypted by the client.
// Legacy server-encrypted columns remain in the database only for migration compatibility.
type CredentialEnvelope struct {
	ImmutableTenantModel
	PlatformAccountID uint64     `gorm:"column:platform_account_id;not null;index"`
	KeyID             string     `gorm:"column:key_id;type:varchar(128);not null"`
	Algorithm         string     `gorm:"column:algorithm;type:varchar(64);not null"`
	CredentialPayload string     `gorm:"column:credential_payload;type:longtext"`
	EnvelopeVersion   uint32     `gorm:"column:envelope_version;not null"`
	Status            string     `gorm:"column:status;type:varchar(32);not null;index"`
	ExpiresAt         *time.Time `gorm:"column:expires_at"`
	DestroyedAt       *time.Time `gorm:"column:destroyed_at;index"`
}

func (CredentialEnvelope) TableName() string { return TableCredentialEnvelopes }

// WritingModelCredential stores an encrypted platform-side model API key.
type WritingModelCredential struct {
	BaseModel
	WritingModelID uint64 `gorm:"column:writing_model_id;not null;uniqueIndex"`
	KeyID          string `gorm:"column:key_id;type:varchar(128);not null"`
	Algorithm      string `gorm:"column:algorithm;type:varchar(64);not null"`
	Ciphertext     []byte `gorm:"column:ciphertext;type:blob;not null"`
	Nonce          []byte `gorm:"column:nonce;type:varbinary(64);not null"`
	Version        uint64 `gorm:"column:version;not null;default:1"`
}

func (WritingModelCredential) TableName() string { return TableWritingModelCredentials }

// AuthorizationSession is a short-lived, device-bound authorization ceremony.
type AuthorizationSession struct {
	TenantModel
	SessionTokenHash  string     `gorm:"column:session_token_hash;type:char(64);not null;uniqueIndex"`
	DeviceID          string     `gorm:"column:device_id;type:varchar(128);not null;index"`
	ResourceType      int32      `gorm:"column:resource_type;type:tinyint unsigned;not null"`
	ResourceID        uint64     `gorm:"column:resource_id;not null"`
	PlatformAccountID *uint64    `gorm:"column:platform_account_id"`
	Status            int32      `gorm:"column:status;type:tinyint unsigned;not null;index"`
	ExpiresAt         time.Time  `gorm:"column:expires_at;not null;index"`
	CompletedAt       *time.Time `gorm:"column:completed_at"`
	ClientVersion     string     `gorm:"column:client_version;type:varchar(64)"`
	Version           uint64     `gorm:"column:version;not null;default:1"`
}

func (AuthorizationSession) TableName() string { return TableAuthorizationSessions }

// AuthorizationEvent is an append-only, sanitized security event.
type AuthorizationEvent struct {
	ImmutableTenantModel
	AuthorizationSessionID *uint64 `gorm:"column:authorization_session_id;index"`
	PlatformAccountID      *uint64 `gorm:"column:platform_account_id;index"`
	EventType              string  `gorm:"column:event_type;type:varchar(64);not null;index"`
	Status                 string  `gorm:"column:status;type:varchar(32);not null"`
	DeviceID               string  `gorm:"column:device_id;type:varchar(128);not null"`
	IPAddress              string  `gorm:"column:ip_address;type:varchar(64)"`
	MetadataJSON           []byte  `gorm:"column:metadata_json;type:json"`
}

func (AuthorizationEvent) TableName() string { return TableAuthorizationEvents }
