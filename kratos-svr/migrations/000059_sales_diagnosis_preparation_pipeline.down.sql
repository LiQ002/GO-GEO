DROP TABLE IF EXISTS sls_diagnosis_brand_terms;
DROP TABLE IF EXISTS sls_diagnosis_preparation_attempts;
DROP TABLE IF EXISTS sls_diagnosis_preparations;

ALTER TABLE sls_diagnosis_questions
  DROP CONSTRAINT chk_sls_diag_question_source,
  DROP COLUMN reason,
  DROP COLUMN intent,
  DROP COLUMN source_type;
