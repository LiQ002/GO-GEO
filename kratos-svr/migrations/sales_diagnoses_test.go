package migrations

import (
	"strings"
	"testing"
)

func TestSalesDiagnosisMigration(t *testing.T) {
	t.Parallel()

	content, err := Files.ReadFile("000053_sales_diagnoses.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	sql := string(content)
	for _, fragment := range []string{
		"CREATE TABLE IF NOT EXISTS sls_diagnoses",
		"CREATE TABLE IF NOT EXISTS sls_diagnosis_profiles",
		"CREATE TABLE IF NOT EXISTS sls_diagnosis_questions",
		"CREATE TABLE IF NOT EXISTS sls_diagnosis_models",
		"CREATE TABLE IF NOT EXISTS sls_diagnosis_tasks",
		"CREATE TABLE IF NOT EXISTS sls_diagnosis_results",
		"CREATE TABLE IF NOT EXISTS sls_diagnosis_citations",
		"CREATE TABLE IF NOT EXISTS sls_diagnosis_metrics",
		"UNIQUE KEY uk_sls_diag_task (diagnosis_id, question_id, diagnosis_model_id)",
		"UNIQUE KEY uk_sls_diag_result_attempt (task_id, attempt_no)",
		"CHECK (",
	} {
		if !strings.Contains(sql, fragment) {
			t.Errorf("sales diagnosis migration missing %q", fragment)
		}
	}
}

func TestSalesDiagnosisPermissionMigration(t *testing.T) {
	t.Parallel()

	content, err := Files.ReadFile("000054_sales_diagnosis_permissions.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	sql := string(content)
	for _, fragment := range []string{
		"sales.diagnosis.read",
		"sales.diagnosis.manage",
		"r.code IN ('super_admin','sales','sales_manager')",
	} {
		if !strings.Contains(sql, fragment) {
			t.Errorf("sales diagnosis permission migration missing %q", fragment)
		}
	}
}
