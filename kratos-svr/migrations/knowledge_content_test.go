package migrations

import (
	"strings"
	"testing"
)

func TestKnowledgeContentMigrationAddsCategoryAndContent(t *testing.T) {
	t.Parallel()

	script, err := Files.ReadFile("000022_simplify_knowledge_content.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	sql := string(script)
	for _, fragment := range []string{
		"ADD COLUMN category TINYINT UNSIGNED NOT NULL DEFAULT 1",
		"ADD COLUMN content LONGTEXT NULL",
		"idx_kb_document_tenant_category",
	} {
		if !strings.Contains(sql, fragment) {
			t.Errorf("migration does not contain %q", fragment)
		}
	}
}
