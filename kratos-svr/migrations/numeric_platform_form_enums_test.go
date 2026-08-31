package migrations

import (
	"io/fs"
	"strings"
	"testing"
)

func TestNumericPlatformFormEnumsMigration(t *testing.T) {
	t.Parallel()

	up, err := fs.ReadFile(Files, "000018_numeric_platform_form_enums.up.sql")
	if err != nil {
		t.Fatalf("read up migration: %v", err)
	}
	down, err := fs.ReadFile(Files, "000018_numeric_platform_form_enums.down.sql")
	if err != nil {
		t.Fatalf("read down migration: %v", err)
	}

	upSQL := string(up)
	for _, fragment := range []string{
		"ent_plan_limits MODIFY COLUMN metric TINYINT UNSIGNED NOT NULL",
		"adm_roles MODIFY COLUMN data_scope TINYINT UNSIGNED NOT NULL",
		"cfg_article_types MODIFY COLUMN source_type TINYINT UNSIGNED NOT NULL",
		"cfg_publish_channels MODIFY COLUMN execution_mode TINYINT UNSIGNED NOT NULL",
		"cfg_inclusion_sites MODIFY COLUMN authorization_type TINYINT UNSIGNED NOT NULL",
		"cfg_writing_models MODIFY COLUMN provider TINYINT UNSIGNED NOT NULL",
		"cfg_writing_model_purposes MODIFY COLUMN purpose TINYINT UNSIGNED NOT NULL",
	} {
		if !strings.Contains(upSQL, fragment) {
			t.Fatalf("up migration missing %q", fragment)
		}
	}
	if !strings.Contains(string(down), "cfg_writing_models MODIFY COLUMN provider VARCHAR(64) NOT NULL") {
		t.Fatal("down migration does not restore writing model provider type")
	}
}
