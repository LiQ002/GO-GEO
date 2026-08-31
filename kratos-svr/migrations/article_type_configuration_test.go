package migrations

import (
	"strings"
	"testing"
)

func TestArticleTypeConfigurationMigrationIsNormalized(t *testing.T) {
	script, err := Files.ReadFile("000021_simplify_article_type_configuration.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	sql := string(script)
	for _, table := range []string{
		"cfg_article_type_sections",
		"cfg_article_type_input_fields",
		"cfg_article_type_input_options",
		"cfg_article_type_rules",
		"cfg_article_type_models",
		"cfg_article_type_version_channels",
	} {
		if !strings.Contains(sql, "CREATE TABLE IF NOT EXISTS "+table) {
			t.Errorf("migration does not create %s", table)
		}
	}
	if strings.Contains(sql, "ADD COLUMN config_json") {
		t.Fatal("article type configuration must not be stored in a single JSON column")
	}
}
