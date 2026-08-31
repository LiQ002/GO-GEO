package migrations

import (
	"io/fs"
	"strings"
	"testing"

	"kratos-svr/internal/security"
)

const (
	initialAdminMigration = "000008_initial_admin.up.sql"
	initialAdminPassword  = "GeoAdmin@2026"
	initialAdminHash      = "$2a$10$QJ2fhm64eqbFcKa2ckmz7OiImFlgFKkBq4vaRQpMcavAXsEGU6jQK"
)

func TestInitialAdminMigration(t *testing.T) {
	script, err := fs.ReadFile(Files, initialAdminMigration)
	if err != nil {
		t.Fatalf("read %s: %v", initialAdminMigration, err)
	}

	content := string(script)
	for _, required := range []string{
		"WHERE NOT EXISTS (SELECT 1 FROM adm_users WHERE username = 'admin')",
		"WHERE NOT EXISTS (SELECT 1 FROM adm_roles WHERE code = 'super_admin')",
		"FROM adm_role_bindings b",
		"FROM adm_role_permissions rp",
		initialAdminHash,
	} {
		if !strings.Contains(content, required) {
			t.Errorf("%s does not contain %q", initialAdminMigration, required)
		}
	}

	if !security.ComparePassword(initialAdminHash, initialAdminPassword) {
		t.Fatal("initial admin password does not match the migration hash")
	}
}
