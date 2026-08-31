package migrations

import (
	"strings"
	"testing"
)

func TestSalesOpportunityMigration(t *testing.T) {
	content, err := Files.ReadFile("000051_sales_opportunities.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	sql := string(content)
	for _, fragment := range []string{
		"CREATE TABLE IF NOT EXISTS sls_opportunities",
		"CREATE TABLE IF NOT EXISTS sls_opportunity_brand_aliases",
		"CREATE TABLE IF NOT EXISTS sls_opportunity_products",
		"CREATE TABLE IF NOT EXISTS sls_opportunity_competitors",
		"budget_min_minor_units BIGINT",
		"FOREIGN KEY (owner_admin_id) REFERENCES adm_users(id)",
		"ON DELETE CASCADE",
	} {
		if !strings.Contains(sql, fragment) {
			t.Errorf("sales opportunity migration missing %q", fragment)
		}
	}
}
