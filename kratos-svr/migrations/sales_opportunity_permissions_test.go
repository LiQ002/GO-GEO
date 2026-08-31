package migrations

import (
	"strings"
	"testing"
)

func TestSalesOpportunityPermissionMigration(t *testing.T) {
	content, err := Files.ReadFile("000052_sales_opportunity_permissions.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	sql := string(content)
	for _, fragment := range []string{
		"sales.opportunity.read",
		"sales.opportunity.manage",
		"'sales','销售人员'",
		"'sales_manager','销售负责人'",
		"r.code IN ('super_admin','sales','sales_manager')",
	} {
		if !strings.Contains(sql, fragment) {
			t.Errorf("sales opportunity permission migration missing %q", fragment)
		}
	}
}
