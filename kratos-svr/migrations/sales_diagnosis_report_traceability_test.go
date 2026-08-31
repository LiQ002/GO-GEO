package migrations

import (
	"strings"
	"testing"
)

func TestSalesDiagnosisReportTraceabilityMigration(t *testing.T) {
	t.Parallel()

	upContent, err := Files.ReadFile("000056_sales_diagnosis_report_traceability.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	up := string(upContent)
	for _, fragment := range []string{
		"citation_capability",
		"CREATE TABLE IF NOT EXISTS sls_diagnosis_profile_claims",
		"CREATE TABLE IF NOT EXISTS sls_diagnosis_result_analyses",
		"CREATE TABLE IF NOT EXISTS sls_diagnosis_entity_mentions",
		"CREATE TABLE IF NOT EXISTS sls_diagnosis_claim_matches",
		"CREATE TABLE IF NOT EXISTS sls_diagnosis_metric_samples",
		"CREATE TABLE IF NOT EXISTS sls_diagnosis_finding_evidences",
		"CREATE TABLE IF NOT EXISTS sls_diagnosis_report_entities",
		"CREATE TABLE IF NOT EXISTS sls_diagnosis_report_sources",
		"CREATE TABLE IF NOT EXISTS sls_diagnosis_report_entity_evidences",
		"CREATE TABLE IF NOT EXISTS sls_diagnosis_report_source_citations",
		"uk_sls_diag_report_version",
	} {
		if !strings.Contains(up, fragment) {
			t.Fatalf("up migration missing %q", fragment)
		}
	}

	downContent, err := Files.ReadFile("000056_sales_diagnosis_report_traceability.down.sql")
	if err != nil {
		t.Fatal(err)
	}
	down := string(downContent)
	for _, fragment := range []string{
		"DROP TABLE IF EXISTS sls_diagnosis_report_sources",
		"DROP TABLE IF EXISTS sls_diagnosis_metric_samples",
		"DROP TABLE IF EXISTS sls_diagnosis_result_analyses",
		"DROP COLUMN citation_capability",
	} {
		if !strings.Contains(down, fragment) {
			t.Fatalf("down migration missing %q", fragment)
		}
	}
}
