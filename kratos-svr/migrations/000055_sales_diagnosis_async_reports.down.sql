DROP TABLE IF EXISTS sls_diagnosis_report_findings;
DROP TABLE IF EXISTS sls_diagnosis_report_answers;
DROP TABLE IF EXISTS sls_diagnosis_report_questions;
DROP TABLE IF EXISTS sls_diagnosis_report_models;
DROP TABLE IF EXISTS sls_diagnosis_reports;

ALTER TABLE sls_diagnosis_tasks
  DROP INDEX idx_sls_diag_task_lease_token,
  DROP INDEX idx_sls_diag_task_queue,
  DROP COLUMN lease_expires_at,
  DROP COLUMN lease_token,
  DROP COLUMN lease_owner,
  DROP COLUMN available_at;
