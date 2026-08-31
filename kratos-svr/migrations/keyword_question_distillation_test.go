package migrations

import (
	"strings"
	"testing"
)

func TestKeywordQuestionDistillationMigration(t *testing.T) {
	t.Parallel()

	script, err := Files.ReadFile("000024_keyword_question_distillation.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	sql := string(script)
	for _, fragment := range []string{
		"ADD COLUMN region VARCHAR(128)",
		"ADD COLUMN requested_question_count INT UNSIGNED NOT NULL DEFAULT 0",
		"ADD COLUMN distillation_status TINYINT UNSIGNED NOT NULL DEFAULT 1",
		"ADD COLUMN source TINYINT UNSIGNED NOT NULL DEFAULT 1",
		"CREATE TABLE IF NOT EXISTS cnt_keyword_distillation_tasks",
		"status TINYINT UNSIGNED NOT NULL",
		"UNIQUE KEY uk_keyword_distillation_request (enterprise_id, client_request_id)",
		"prompt_snapshot LONGTEXT NOT NULL",
	} {
		if !strings.Contains(sql, fragment) {
			t.Errorf("keyword distillation migration does not contain %q", fragment)
		}
	}
}
