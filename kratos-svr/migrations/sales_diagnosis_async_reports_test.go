package migrations

import (
	"strings"
	"testing"
)

func TestSalesDiagnosisAsyncReportMigration(t *testing.T) {
	t.Parallel()

	upContent, err := Files.ReadFile("000055_sales_diagnosis_async_reports.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	up := string(upContent)
	for _, fragment := range []string{
		"lease_token VARCHAR(64)",
		"lease_expires_at DATETIME(6)",
		"idx_sls_diag_task_queue",
		"CREATE TABLE IF NOT EXISTS sls_diagnosis_reports",
		"CREATE TABLE IF NOT EXISTS sls_diagnosis_report_models",
		"CREATE TABLE IF NOT EXISTS sls_diagnosis_report_questions",
		"CREATE TABLE IF NOT EXISTS sls_diagnosis_report_answers",
		"CREATE TABLE IF NOT EXISTS sls_diagnosis_report_findings",
	} {
		if !strings.Contains(up, fragment) {
			t.Fatalf("up migration missing %q", fragment)
		}
	}

	downContent, err := Files.ReadFile("000055_sales_diagnosis_async_reports.down.sql")
	if err != nil {
		t.Fatal(err)
	}
	down := string(downContent)
	for _, fragment := range []string{
		"DROP TABLE IF EXISTS sls_diagnosis_reports",
		"DROP COLUMN lease_expires_at",
		"DROP COLUMN available_at",
	} {
		if !strings.Contains(down, fragment) {
			t.Fatalf("down migration missing %q", fragment)
		}
	}
}
