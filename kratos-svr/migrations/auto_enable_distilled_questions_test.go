package migrations

import (
	"strings"
	"testing"
)

func TestAutoEnableDistilledQuestionsMigration(t *testing.T) {
	t.Parallel()

	script, err := Files.ReadFile("000025_auto_enable_distilled_questions.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	sql := string(script)
	for _, fragment := range []string{
		"UPDATE cnt_questions",
		"SET status = 2",
		"WHERE source = 2",
		"AND status = 1",
	} {
		if !strings.Contains(sql, fragment) {
			t.Errorf("auto-enable migration does not contain %q", fragment)
		}
	}
}
