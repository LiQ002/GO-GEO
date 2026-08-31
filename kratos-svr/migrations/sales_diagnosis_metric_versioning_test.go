package migrations

import (
	"strings"
	"testing"
)

func TestSalesDiagnosisMetricVersioningMigration(t *testing.T) {
	t.Parallel()

	upContent, err := Files.ReadFile("000062_version_sales_diagnosis_metrics.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	up := string(upContent)
	for _, fragment := range []string{
		"ADD COLUMN generation",
		"ADD COLUMN is_current",
		"uk_sls_diag_metric_generation",
		"idx_sls_diag_metric_current",
	} {
		if !strings.Contains(up, fragment) {
			t.Fatalf("up migration missing %q", fragment)
		}
	}

	downContent, err := Files.ReadFile("000062_version_sales_diagnosis_metrics.down.sql")
	if err != nil {
		t.Fatal(err)
	}
	down := string(downContent)
	for _, fragment := range []string{
		"DELETE evidence",
		"WHERE metric.is_current = FALSE",
		"DROP COLUMN is_current",
		"DROP COLUMN generation",
		"uk_sls_diag_metric",
	} {
		if !strings.Contains(down, fragment) {
			t.Fatalf("down migration missing %q", fragment)
		}
	}
}
