ALTER TABLE sls_diagnosis_tasks
  ADD COLUMN available_at DATETIME(6) NULL AFTER completed_at,
  ADD COLUMN lease_owner VARCHAR(128) NULL AFTER available_at,
  ADD COLUMN lease_token VARCHAR(64) NULL AFTER lease_owner,
  ADD COLUMN lease_expires_at DATETIME(6) NULL AFTER lease_token;

UPDATE sls_diagnosis_tasks
SET available_at = COALESCE(completed_at, started_at, created_at)
WHERE available_at IS NULL;

ALTER TABLE sls_diagnosis_tasks
  MODIFY COLUMN available_at DATETIME(6) NOT NULL,
  ADD KEY idx_sls_diag_task_queue (status, available_at, lease_expires_at, id),
  ADD KEY idx_sls_diag_task_lease_token (lease_token);

CREATE TABLE IF NOT EXISTS sls_diagnosis_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  diagnosis_id BIGINT UNSIGNED NOT NULL,
  status TINYINT UNSIGNED NOT NULL,
  template_code VARCHAR(64) NOT NULL,
  template_version INT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  executive_summary TEXT NOT NULL,
  overall_conclusion TEXT NOT NULL,
  methodology TEXT NOT NULL,
  disclaimer TEXT NOT NULL,
  generated_at DATETIME(6) NOT NULL,
  version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sls_diag_report_diagnosis (diagnosis_id),
  KEY idx_sls_diag_report_status_generated (status, generated_at),
  CONSTRAINT fk_sls_diag_report_diagnosis FOREIGN KEY (diagnosis_id) REFERENCES sls_diagnoses(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT chk_sls_diag_report_status CHECK (status IN (1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sls_diagnosis_report_models (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  report_id BIGINT UNSIGNED NOT NULL,
  diagnosis_model_id BIGINT UNSIGNED NOT NULL,
  model_name VARCHAR(128) NOT NULL,
  sample_count INT UNSIGNED NOT NULL,
  succeeded_count INT UNSIGNED NOT NULL,
  failed_count INT UNSIGNED NOT NULL,
  brand_mention_rate DECIMAL(12,6) NOT NULL,
  citation_rate DECIMAL(12,6) NOT NULL,
  brand_share_of_voice DECIMAL(12,6) NOT NULL,
  summary TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sls_diag_report_model (report_id, diagnosis_model_id),
  KEY idx_sls_diag_report_model_sort (report_id, sort_order, id),
  KEY idx_sls_diag_report_model_source (diagnosis_model_id),
  CONSTRAINT fk_sls_diag_report_model_report FOREIGN KEY (report_id) REFERENCES sls_diagnosis_reports(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_sls_diag_report_model_source FOREIGN KEY (diagnosis_model_id) REFERENCES sls_diagnosis_models(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sls_diagnosis_report_questions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  report_id BIGINT UNSIGNED NOT NULL,
  question_id BIGINT UNSIGNED NOT NULL,
  question TEXT NOT NULL,
  successful_model_count INT UNSIGNED NOT NULL,
  failed_model_count INT UNSIGNED NOT NULL,
  brand_mentioned_model_count INT UNSIGNED NOT NULL,
  competitor_mentioned_model_count INT UNSIGNED NOT NULL,
  summary TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sls_diag_report_question (report_id, question_id),
  KEY idx_sls_diag_report_question_sort (report_id, sort_order, id),
  KEY idx_sls_diag_report_question_source (question_id),
  CONSTRAINT fk_sls_diag_report_question_report FOREIGN KEY (report_id) REFERENCES sls_diagnosis_reports(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_sls_diag_report_question_source FOREIGN KEY (question_id) REFERENCES sls_diagnosis_questions(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sls_diagnosis_report_answers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  report_question_id BIGINT UNSIGNED NOT NULL,
  result_id BIGINT UNSIGNED NOT NULL,
  diagnosis_model_id BIGINT UNSIGNED NOT NULL,
  model_name VARCHAR(128) NOT NULL,
  answer_excerpt TEXT NOT NULL,
  brand_mentioned BOOLEAN NOT NULL,
  evidence_type TINYINT UNSIGNED NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sls_diag_report_answer (report_question_id, result_id),
  KEY idx_sls_diag_report_answer_sort (report_question_id, sort_order, id),
  KEY idx_sls_diag_report_answer_result (result_id),
  KEY idx_sls_diag_report_answer_model (diagnosis_model_id),
  CONSTRAINT fk_sls_diag_report_answer_question FOREIGN KEY (report_question_id) REFERENCES sls_diagnosis_report_questions(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_sls_diag_report_answer_result FOREIGN KEY (result_id) REFERENCES sls_diagnosis_results(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_sls_diag_report_answer_model FOREIGN KEY (diagnosis_model_id) REFERENCES sls_diagnosis_models(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_sls_diag_report_answer_evidence CHECK (evidence_type IN (1,2))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sls_diagnosis_report_findings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  report_id BIGINT UNSIGNED NOT NULL,
  finding_type TINYINT UNSIGNED NOT NULL,
  severity TINYINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_sls_diag_report_finding_sort (report_id, finding_type, sort_order, id),
  CONSTRAINT fk_sls_diag_report_finding_report FOREIGN KEY (report_id) REFERENCES sls_diagnosis_reports(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT chk_sls_diag_report_finding_type CHECK (finding_type IN (1,2,3)),
  CONSTRAINT chk_sls_diag_report_finding_severity CHECK (severity IN (1,2,3))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
