package migrations

import (
	"io/fs"
	"strings"
	"testing"
)

func TestNumericUserFormEnumsMigration(t *testing.T) {
	t.Parallel()

	up, err := fs.ReadFile(Files, "000017_numeric_user_form_enums.up.sql")
	if err != nil {
		t.Fatalf("read up migration: %v", err)
	}
	down, err := fs.ReadFile(Files, "000017_numeric_user_form_enums.down.sql")
	if err != nil {
		t.Fatalf("read down migration: %v", err)
	}

	upSQL := string(up)
	for _, fragment := range []string{
		"cnt_brands MODIFY COLUMN status TINYINT UNSIGNED NOT NULL",
		"kb_documents MODIFY COLUMN source_type TINYINT UNSIGNED NOT NULL",
		"cnt_questions MODIFY COLUMN intent TINYINT UNSIGNED NOT NULL",
		"pub_plans MODIFY COLUMN schedule_type TINYINT UNSIGNED NOT NULL",
		"geo_monitor_plans MODIFY COLUMN status TINYINT UNSIGNED NOT NULL",
		"sec_authorization_sessions MODIFY COLUMN resource_type TINYINT UNSIGNED NOT NULL",
	} {
		if !strings.Contains(upSQL, fragment) {
			t.Fatalf("up migration missing %q", fragment)
		}
	}
	if !strings.Contains(string(down), "cnt_brands MODIFY COLUMN status VARCHAR(32) NOT NULL") {
		t.Fatal("down migration does not restore brand status type")
	}
}
