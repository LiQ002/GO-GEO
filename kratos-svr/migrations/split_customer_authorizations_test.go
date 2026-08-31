package migrations

import (
	"io/fs"
	"strings"
	"testing"
)

func TestSplitCustomerAuthorizationsMigration(t *testing.T) {
	t.Parallel()

	script, err := fs.ReadFile(Files, "000015_split_customer_authorizations.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	content := string(script)
	for _, required := range []string{
		"CREATE TABLE IF NOT EXISTS sec_authorization_account_ids",
		"CREATE TABLE IF NOT EXISTS sec_self_media_authorizations",
		"CREATE TABLE IF NOT EXISTS sec_inclusion_site_authorizations",
		"WHERE resource_type = 'publish_channel'",
		"WHERE resource_type = 'inclusion_site'",
	} {
		if !strings.Contains(content, required) {
			t.Errorf("split migration does not contain %q", required)
		}
	}
	if strings.Contains(content, "DROP TABLE IF EXISTS sec_platform_accounts") {
		t.Fatal("backfill migration must not drop the legacy table before its version is recorded")
	}

	dropScript, err := fs.ReadFile(Files, "000016_drop_legacy_platform_accounts.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	if strings.TrimSpace(string(dropScript)) != "DROP TABLE IF EXISTS sec_platform_accounts;" {
		t.Fatal("legacy table removal must remain an idempotent standalone migration")
	}
}
