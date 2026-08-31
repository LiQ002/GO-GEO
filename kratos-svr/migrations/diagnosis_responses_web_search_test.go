package migrations

import (
	"io/fs"
	"strings"
	"testing"
)

func TestDiagnosisResponsesWebSearchMigration(t *testing.T) {
	t.Parallel()

	content, err := fs.ReadFile(Files, "000060_diagnosis_responses_web_search.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	sql := string(content)
	for _, fragment := range []string{
		"diagnosis_api_mode",
		"diagnosis_web_search_enabled",
		"ALTER TABLE sls_diagnosis_models",
		"p.purpose = 6",
		"m.model_id LIKE 'deepseek-v4-%'",
		"m.model_id LIKE 'qwen3%'",
		"https://api.deepseek.com",
	} {
		if !strings.Contains(sql, fragment) {
			t.Fatalf("migration missing %q", fragment)
		}
	}
}
