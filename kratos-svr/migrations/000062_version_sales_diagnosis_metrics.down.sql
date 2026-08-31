DELETE evidence
FROM sls_diagnosis_finding_evidences evidence
JOIN sls_diagnosis_report_findings finding ON finding.id = evidence.finding_id
JOIN sls_diagnosis_reports report ON report.id = finding.report_id
WHERE report.is_current = FALSE
  AND evidence.metric_id IS NOT NULL;

DELETE sample
FROM sls_diagnosis_metric_samples sample
JOIN sls_diagnosis_metrics metric ON metric.id = sample.metric_id
WHERE metric.is_current = FALSE;

DELETE FROM sls_diagnosis_metrics WHERE is_current = FALSE;

ALTER TABLE sls_diagnosis_metrics
  DROP INDEX idx_sls_diag_metric_current,
  DROP INDEX uk_sls_diag_metric_generation,
  DROP COLUMN is_current,
  DROP COLUMN generation,
  ADD UNIQUE KEY uk_sls_diag_metric (diagnosis_id, diagnosis_model_id, metric_code);
