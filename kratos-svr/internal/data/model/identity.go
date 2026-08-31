package model

import "time"

// AdminUser is an internal platform operator.
type AdminUser struct {
	SoftDeleteModel
	Username          string     `gorm:"column:username;type:varchar(64);not null;uniqueIndex"`
	DisplayName       string     `gorm:"column:display_name;type:varchar(128);not null"`
	Email             string     `gorm:"column:email;type:varchar(255);index"`
	PasswordHash      string     `gorm:"column:password_hash;type:varchar(255);not null"`
	Status            string     `gorm:"column:status;type:varchar(32);not null;index"`
	MFASecretEnvelope []byte     `gorm:"column:mfa_secret_envelope;type:blob"`
	FailedLoginCount  uint32     `gorm:"column:failed_login_count;not null;default:0"`
	LockedUntil       *time.Time `gorm:"column:locked_until"`
	LastLoginAt       *time.Time `gorm:"column:last_login_at"`
	PasswordChangedAt time.Time  `gorm:"column:password_changed_at;not null"`
}

func (AdminUser) TableName() string { return TableAdminUsers }

// AdminRole groups platform permissions and data scope.
type AdminRole struct {
	SoftDeleteModel
	Code        string `gorm:"column:code;type:varchar(64);not null;uniqueIndex"`
	Name        string `gorm:"column:name;type:varchar(128);not null"`
	Description string `gorm:"column:description;type:varchar(512)"`
	DataScope   int32  `gorm:"column:data_scope;type:tinyint unsigned;not null"`
	Status      int32  `gorm:"column:status;type:tinyint unsigned;not null"`
}

func (AdminRole) TableName() string { return TableAdminRoles }

// AdminPermission is a stable operation permission point.
type AdminPermission struct {
	BaseModel
	Code        string `gorm:"column:code;type:varchar(128);not null;uniqueIndex"`
	Name        string `gorm:"column:name;type:varchar(128);not null"`
	Resource    string `gorm:"column:resource;type:varchar(64);not null;index"`
	Action      string `gorm:"column:action;type:varchar(64);not null"`
	Description string `gorm:"column:description;type:varchar(512)"`
}

func (AdminPermission) TableName() string { return TableAdminPermissions }

// AdminRoleBinding binds an admin to a role and optional permission.
type AdminRoleBinding struct {
	BaseModel
	AdminUserID uint64 `gorm:"column:admin_user_id;not null;uniqueIndex:uk_adm_role_binding,priority:1"`
	RoleID      uint64 `gorm:"column:role_id;not null;uniqueIndex:uk_adm_role_binding,priority:2"`
}

func (AdminRoleBinding) TableName() string { return TableAdminRoleBindings }

// AdminRolePermission binds a role to a stable permission point.
type AdminRolePermission struct {
	BaseModel
	RoleID       uint64 `gorm:"column:role_id;not null;uniqueIndex:uk_adm_role_permission,priority:1"`
	PermissionID uint64 `gorm:"column:permission_id;not null;uniqueIndex:uk_adm_role_permission,priority:2"`
}

func (AdminRolePermission) TableName() string { return TableAdminRolePermissions }

// LoginSession represents a revocable web or client session.
type LoginSession struct {
	BaseModel
	EnterpriseID     *uint64    `gorm:"column:enterprise_id;index"`
	SubjectType      string     `gorm:"column:subject_type;type:varchar(32);not null;index"`
	SubjectID        uint64     `gorm:"column:subject_id;not null;index"`
	Audience         string     `gorm:"column:audience;type:varchar(32);not null"`
	RefreshTokenHash string     `gorm:"column:refresh_token_hash;type:char(64);not null;uniqueIndex"`
	DeviceID         string     `gorm:"column:device_id;type:varchar(128);index"`
	IPAddress        string     `gorm:"column:ip_address;type:varchar(64)"`
	UserAgent        string     `gorm:"column:user_agent;type:varchar(512)"`
	ExpiresAt        time.Time  `gorm:"column:expires_at;not null;index"`
	LastSeenAt       time.Time  `gorm:"column:last_seen_at;not null"`
	RevokedAt        *time.Time `gorm:"column:revoked_at;index"`
	RevokeReason     string     `gorm:"column:revoke_reason;type:varchar(255)"`
}

func (LoginSession) TableName() string { return TableLoginSessions }
