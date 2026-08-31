package migrations

import (
	"strings"
	"testing"
)

func TestSalesDiagnosisV4ReportMigration(t *testing.T) {
	t.Parallel()

	upContent, err := Files.ReadFile("000058_sales_diagnosis_v4_report.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	up := string(upContent)
	for _, fragment := range []string{
		"completeness_score",
		"answer_quality_score",
		"freshness_available",
		"recommendation_position",
		"source_type",
		"competitor_level",
		"threat_level",
		"section_code",
		"diagnosis_conclusion",
	} {
		if !strings.Contains(up, fragment) {
			t.Fatalf("up migration missing %q", fragment)
		}
	}

	downContent, err := Files.ReadFile("000058_sales_diagnosis_v4_report.down.sql")
	if err != nil {
		t.Fatal(err)
	}
	down := string(downContent)
	for _, fragment := range []string{
		"DROP COLUMN completeness_score",
		"DROP COLUMN source_type",
		"DROP COLUMN competitor_level",
		"DROP COLUMN section_code",
	} {
		if !strings.Contains(down, fragment) {
			t.Fatalf("down migration missing %q", fragment)
		}
	}
}
