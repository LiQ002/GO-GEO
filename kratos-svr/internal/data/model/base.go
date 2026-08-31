// Package model contains the shared GORM persistence models used by both apps.
// It intentionally contains no database connection or repository logic.
package model

import (
	"time"

	"gorm.io/gorm"
)

// BaseModel contains common fields for immutable and mutable records.
type BaseModel struct {
	ID        uint64    `gorm:"column:id;primaryKey;autoIncrement"`
	CreatedAt time.Time `gorm:"column:created_at;not null"`
	UpdatedAt time.Time `gorm:"column:updated_at;not null"`
}

// SoftDeleteModel adds recoverable deletion to BaseModel.
type SoftDeleteModel struct {
	BaseModel
	DeletedAt gorm.DeletedAt `gorm:"column:deleted_at;index"`
}

// TenantModel is embedded by every enterprise-owned mutable resource.
type TenantModel struct {
	SoftDeleteModel
	EnterpriseID uint64 `gorm:"column:enterprise_id;not null;index"`
}

// ImmutableTenantModel is embedded by append-only enterprise records.
type ImmutableTenantModel struct {
	ID           uint64    `gorm:"column:id;primaryKey;autoIncrement"`
	EnterpriseID uint64    `gorm:"column:enterprise_id;not null;index"`
	CreatedAt    time.Time `gorm:"column:created_at;not null"`
}
