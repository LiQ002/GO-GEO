ALTER TABLE sls_diagnosis_metrics
  DROP INDEX uk_sls_diag_metric,
  ADD COLUMN generation BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER rule_version,
  ADD COLUMN is_current BOOLEAN NOT NULL DEFAULT TRUE AFTER generation,
  ADD UNIQUE KEY uk_sls_diag_metric_generation (diagnosis_id, diagnosis_model_id, metric_code, generation),
  ADD KEY idx_sls_diag_metric_current (diagnosis_id, is_current, diagnosis_model_id, metric_code);
