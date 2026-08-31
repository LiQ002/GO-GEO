package data

import (
	"database/sql"
	"slices"
	"testing"

	"kratos-svr/internal/data/model"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func TestActiveAdminQueriesUseNumericRoleStatus(t *testing.T) {
	t.Parallel()

	db, err := gorm.Open(mysql.New(mysql.Config{
		Conn:                      &sql.DB{},
		SkipInitializeWithVersion: true,
	}), &gorm.Config{DisableAutomaticPing: true, DryRun: true})
	if err != nil {
		t.Fatalf("open dry-run database: %v", err)
	}

	tests := []struct {
		name  string
		query func(*gorm.DB) *gorm.DB
	}{
		{name: "roles", query: func(db *gorm.DB) *gorm.DB { return activeAdminRoleQuery(db, 42) }},
		{name: "permissions", query: func(db *gorm.DB) *gorm.DB { return activeAdminPermissionQuery(db, 42) }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var rows []map[string]any
			stmt := tt.query(db).Find(&rows).Statement
			if stmt.Error != nil {
				t.Fatalf("build query: %v", stmt.Error)
			}
			if !slices.Contains(stmt.Vars, any(model.AdminRoleStatusActive)) {
				t.Fatalf("query vars = %#v; want numeric active role status %d", stmt.Vars, model.AdminRoleStatusActive)
			}
			if slices.Contains(stmt.Vars, any("active")) {
				t.Fatalf("query vars = %#v; legacy string role status must not be used", stmt.Vars)
			}
		})
	}
}
