ALTER TABLE sls_diagnoses
  DROP CONSTRAINT chk_sls_diag_subject,
  ADD CONSTRAINT chk_sls_diag_subject CHECK (
    (subject_type = 1 AND opportunity_id IS NOT NULL AND enterprise_id IS NULL) OR
    (subject_type = 2 AND enterprise_id IS NOT NULL AND opportunity_id IS NULL) OR
    (subject_type = 3 AND opportunity_id IS NULL AND enterprise_id IS NULL)
  );

ALTER TABLE sls_diagnosis_questions
  ADD COLUMN source_type TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER question,
  ADD COLUMN intent VARCHAR(128) NULL AFTER source_type,
  ADD COLUMN reason VARCHAR(512) NULL AFTER intent,
  ADD CONSTRAINT chk_sls_diag_question_source CHECK (source_type IN (1,2));

CREATE TABLE IF NOT EXISTS sls_diagnosis_preparations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  diagnosis_id BIGINT UNSIGNED NOT NULL,
  diagnosis_model_id BIGINT UNSIGNED,
  status TINYINT UNSIGNED NOT NULL DEFAULT 1,
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  last_error_code VARCHAR(64),
  last_error_message VARCHAR(1024),
  available_at DATETIME(6) NOT NULL,
  lease_owner VARCHAR(128),
  lease_token VARCHAR(64),
  lease_expires_at DATETIME(6),
  started_at DATETIME(6),
  completed_at DATETIME(6),
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sls_diag_preparation (diagnosis_id),
  KEY idx_sls_diag_prep_queue (status, available_at, lease_expires_at, id),
  KEY idx_sls_diag_prep_model (diagnosis_model_id),
  KEY idx_sls_diag_prep_lease (lease_token),
  CONSTRAINT fk_sls_diag_prep_diag FOREIGN KEY (diagnosis_id) REFERENCES sls_diagnoses(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_sls_diag_prep_model FOREIGN KEY (diagnosis_model_id) REFERENCES sls_diagnosis_models(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_sls_diag_prep_status CHECK (status IN (1,2,3,4,5,6))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sls_diagnosis_preparation_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  preparation_id BIGINT UNSIGNED NOT NULL,
  attempt_no INT UNSIGNED NOT NULL,
  succeeded BOOLEAN NOT NULL DEFAULT FALSE,
  industry VARCHAR(128),
  brand_summary TEXT,
  prompt_snapshot LONGTEXT,
  raw_response_json JSON,
  provider_request_id VARCHAR(255),
  response_model VARCHAR(128),
  input_tokens BIGINT UNSIGNED NOT NULL DEFAULT 0,
  output_tokens BIGINT UNSIGNED NOT NULL DEFAULT 0,
  cost_micros BIGINT NOT NULL DEFAULT 0,
  duration_ms BIGINT UNSIGNED NOT NULL DEFAULT 0,
  error_code VARCHAR(64),
  error_message VARCHAR(1024),
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sls_diag_prep_attempt (preparation_id, attempt_no),
  KEY idx_sls_diag_prep_attempt_result (preparation_id, succeeded, created_at),
  CONSTRAINT fk_sls_diag_prep_attempt FOREIGN KEY (preparation_id) REFERENCES sls_diagnosis_preparations(id) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sls_diagnosis_brand_terms (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  diagnosis_id BIGINT UNSIGNED NOT NULL,
  term VARCHAR(255) NOT NULL,
  term_type TINYINT UNSIGNED NOT NULL,
  reason VARCHAR(512),
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sls_diag_brand_term (diagnosis_id, term, term_type),
  KEY idx_sls_diag_brand_term_sort (diagnosis_id, sort_order, id),
  KEY idx_sls_diag_brand_term_type (diagnosis_id, term_type),
  CONSTRAINT fk_sls_diag_brand_term FOREIGN KEY (diagnosis_id) REFERENCES sls_diagnoses(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT chk_sls_diag_brand_term_type CHECK (term_type IN (1,2,3,4,5,6))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
