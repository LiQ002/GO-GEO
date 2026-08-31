DROP TABLE IF EXISTS sls_diagnosis_report_source_citations;
DROP TABLE IF EXISTS sls_diagnosis_report_entity_evidences;
DROP TABLE IF EXISTS sls_diagnosis_report_sources;
DROP TABLE IF EXISTS sls_diagnosis_report_entities;
DROP TABLE IF EXISTS sls_diagnosis_finding_evidences;

ALTER TABLE sls_diagnosis_report_models
  DROP COLUMN unknown_sentiment_count,
  DROP COLUMN negative_count,
  DROP COLUMN neutral_count,
  DROP COLUMN positive_count,
  DROP COLUMN citation_available,
  DROP COLUMN content_adoption_available,
  DROP COLUMN content_adoption_rate,
  DROP COLUMN top3_available,
  DROP COLUMN top3_rate,
  DROP COLUMN mention_count;

ALTER TABLE sls_diagnosis_reports
  DROP INDEX idx_sls_diag_report_current,
  DROP INDEX uk_sls_diag_report_version,
  DROP COLUMN is_current,
  ADD UNIQUE KEY uk_sls_diag_report_diagnosis (diagnosis_id);

DROP TABLE IF EXISTS sls_diagnosis_metric_samples;

ALTER TABLE sls_diagnosis_metrics
  DROP CHECK chk_sls_diag_metric_availability,
  DROP COLUMN rule_version,
  DROP COLUMN availability_status;

ALTER TABLE sls_diagnosis_citations
  DROP CHECK chk_sls_diag_citation_verification,
  DROP CHECK chk_sls_diag_citation_ownership,
  DROP COLUMN captured_at,
  DROP COLUMN verification_status,
  DROP COLUMN ownership_type,
  DROP COLUMN position,
  DROP COLUMN snippet,
  DROP COLUMN source_name,
  DROP COLUMN provider_source_id;

DROP TABLE IF EXISTS sls_diagnosis_claim_matches;
DROP TABLE IF EXISTS sls_diagnosis_entity_mentions;
DROP TABLE IF EXISTS sls_diagnosis_result_analyses;
DROP TABLE IF EXISTS sls_diagnosis_profile_claims;

ALTER TABLE sls_diagnosis_models
  DROP CHECK chk_sls_diag_model_citation_capability,
  DROP COLUMN citation_capability;

ALTER TABLE cfg_writing_models
  DROP CHECK chk_cfg_writing_model_citation_capability,
  DROP COLUMN citation_capability;
