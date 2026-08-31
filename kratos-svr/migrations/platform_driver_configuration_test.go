package migrations

import (
	"io/fs"
	"strings"
	"testing"
)

func TestPlatformDriverConfigurationMigration(t *testing.T) {
	t.Parallel()

	up, err := fs.ReadFile(Files, "000019_platform_driver_configuration.up.sql")
	if err != nil {
		t.Fatalf("read up migration: %v", err)
	}
	down, err := fs.ReadFile(Files, "000019_platform_driver_configuration.down.sql")
	if err != nil {
		t.Fatalf("read down migration: %v", err)
	}

	upSQL := string(up)
	for _, fragment := range []string{
		"cfg_publish_channels\n  ADD COLUMN driver_type TINYINT UNSIGNED",
		"ADD COLUMN login_url VARCHAR(1024)",
		"WHEN code IN ('zhihu', 'c01') OR name = '知乎' THEN 2",
		"WHEN code IN ('toutiao', 'c02') OR name IN ('头条', '头条号', '今日头条') THEN 3",
		"cfg_inclusion_sites\n  ADD COLUMN driver_type TINYINT UNSIGNED",
		"WHEN code IN ('deepseek', 'm01') OR LOWER(name) = 'deepseek'",
		"WHEN code IN ('nami', 'm04') OR name IN ('纳米', '纳米 AI')",
	} {
		if !strings.Contains(upSQL, fragment) {
			t.Fatalf("up migration missing %q", fragment)
		}
	}
	if !strings.Contains(string(down), "DROP COLUMN login_url") {
		t.Fatal("down migration does not remove publish channel login URL")
	}
}
