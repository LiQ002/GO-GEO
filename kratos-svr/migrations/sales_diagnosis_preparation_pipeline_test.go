package migrations

import (
	"strings"
	"testing"
)

func TestSalesDiagnosisPreparationPipelineMigration(t *testing.T) {
	t.Parallel()

	upContent, err := Files.ReadFile("000059_sales_diagnosis_preparation_pipeline.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	up := string(upContent)
	for _, fragment := range []string{
		"subject_type = 3",
		"sls_diagnosis_preparations",
		"sls_diagnosis_preparation_attempts",
		"sls_diagnosis_brand_terms",
		"source_type",
		"lease_expires_at",
	} {
		if !strings.Contains(up, fragment) {
			t.Fatalf("up migration missing %q", fragment)
		}
	}

	downContent, err := Files.ReadFile("000059_sales_diagnosis_preparation_pipeline.down.sql")
	if err != nil {
		t.Fatal(err)
	}
	down := string(downContent)
	for _, fragment := range []string{
		"DROP TABLE IF EXISTS sls_diagnosis_brand_terms",
		"DROP TABLE IF EXISTS sls_diagnosis_preparation_attempts",
		"DROP TABLE IF EXISTS sls_diagnosis_preparations",
		"DROP COLUMN source_type",
	} {
		if !strings.Contains(down, fragment) {
			t.Fatalf("down migration missing %q", fragment)
		}
	}
}
