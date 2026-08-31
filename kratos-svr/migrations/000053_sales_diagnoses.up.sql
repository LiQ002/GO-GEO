CREATE TABLE IF NOT EXISTS sls_diagnoses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  subject_type TINYINT UNSIGNED NOT NULL,
  opportunity_id BIGINT UNSIGNED,
  enterprise_id BIGINT UNSIGNED,
  created_by_admin_id BIGINT UNSIGNED NOT NULL,
  status TINYINT UNSIGNED NOT NULL DEFAULT 1,
  question_count INT UNSIGNED NOT NULL DEFAULT 0,
  model_count INT UNSIGNED NOT NULL DEFAULT 0,
  task_count INT UNSIGNED NOT NULL DEFAULT 0,
  succeeded_task_count INT UNSIGNED NOT NULL DEFAULT 0,
  failed_task_count INT UNSIGNED NOT NULL DEFAULT 0,
  started_at DATETIME(6),
  completed_at DATETIME(6),
  version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sls_diagnoses_code (code),
  KEY idx_sls_diag_subject_created (subject_type, created_at),
  KEY idx_sls_diag_opportunity (opportunity_id, created_at),
  KEY idx_sls_diag_enterprise (enterprise_id, created_at),
  KEY idx_sls_diag_creator_status (created_by_admin_id, status, created_at),
  KEY idx_sls_diag_status (status),
  KEY idx_sls_diag_completed (completed_at),
  CONSTRAINT fk_sls_diag_opportunity FOREIGN KEY (opportunity_id) REFERENCES sls_opportunities(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_sls_diag_enterprise FOREIGN KEY (enterprise_id) REFERENCES ent_enterprises(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_sls_diag_creator FOREIGN KEY (created_by_admin_id) REFERENCES adm_users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_sls_diag_subject CHECK (
    (subject_type = 1 AND opportunity_id IS NOT NULL AND enterprise_id IS NULL) OR
    (subject_type = 2 AND enterprise_id IS NOT NULL AND opportunity_id IS NULL)
  ),
  CONSTRAINT chk_sls_diag_status CHECK (status IN (1,2,3,4,5,6))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sls_diagnosis_profiles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  diagnosis_id BIGINT UNSIGNED NOT NULL,
  customer_name VARCHAR(128) NOT NULL,
  website VARCHAR(512),
  industry VARCHAR(128),
  region VARCHAR(128),
  brand_name VARCHAR(128) NOT NULL,
  target_audience TEXT,
  core_value TEXT,
  current_content TEXT,
  pain_points TEXT,
  expected_goals TEXT,
  source_version BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sls_diag_profile (diagnosis_id),
  CONSTRAINT fk_sls_diag_profile FOREIGN KEY (diagnosis_id) REFERENCES sls_diagnoses(id) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sls_diagnosis_profile_aliases (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  diagnosis_id BIGINT UNSIGNED NOT NULL,
  alias VARCHAR(128) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sls_diag_profile_alias (diagnosis_id, alias),
  KEY idx_sls_diag_profile_alias_sort (diagnosis_id, sort_order, id),
  CONSTRAINT fk_sls_diag_profile_alias FOREIGN KEY (diagnosis_id) REFERENCES sls_diagnoses(id) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sls_diagnosis_profile_products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  diagnosis_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  selling_points TEXT,
  target_audience TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_sls_diag_profile_product (diagnosis_id, sort_order, id),
  CONSTRAINT fk_sls_diag_profile_product FOREIGN KEY (diagnosis_id) REFERENCES sls_diagnoses(id) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sls_diagnosis_profile_competitors (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  diagnosis_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(128) NOT NULL,
  website VARCHAR(512),
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_sls_diag_profile_competitor (diagnosis_id, sort_order, id),
  CONSTRAINT fk_sls_diag_profile_comp FOREIGN KEY (diagnosis_id) REFERENCES sls_diagnoses(id) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sls_diagnosis_questions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  diagnosis_id BIGINT UNSIGNED NOT NULL,
  question TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_sls_diag_question_sort (diagnosis_id, sort_order, id),
  CONSTRAINT fk_sls_diag_question FOREIGN KEY (diagnosis_id) REFERENCES sls_diagnoses(id) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sls_diagnosis_models (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  diagnosis_id BIGINT UNSIGNED NOT NULL,
  writing_model_id BIGINT UNSIGNED NOT NULL,
  display_name VARCHAR(128) NOT NULL,
  provider TINYINT UNSIGNED NOT NULL,
  protocol TINYINT UNSIGNED NOT NULL,
  base_url VARCHAR(512) NOT NULL,
  model_id VARCHAR(128) NOT NULL,
  model_version BIGINT UNSIGNED NOT NULL,
  temperature DECIMAL(4,3) NOT NULL,
  top_p DECIMAL(4,3) NOT NULL,
  max_tokens INT UNSIGNED NOT NULL,
  timeout_seconds INT UNSIGNED NOT NULL,
  input_price_micros_per_million_tokens BIGINT NOT NULL DEFAULT 0,
  output_price_micros_per_million_tokens BIGINT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sls_diag_model (diagnosis_id, writing_model_id),
  KEY idx_sls_diag_model_sort (diagnosis_id, sort_order, id),
  KEY idx_sls_diag_writing_model (writing_model_id),
  CONSTRAINT fk_sls_diag_model_diag FOREIGN KEY (diagnosis_id) REFERENCES sls_diagnoses(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_sls_diag_model_config FOREIGN KEY (writing_model_id) REFERENCES cfg_writing_models(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sls_diagnosis_tasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  diagnosis_id BIGINT UNSIGNED NOT NULL,
  question_id BIGINT UNSIGNED NOT NULL,
  diagnosis_model_id BIGINT UNSIGNED NOT NULL,
  status TINYINT UNSIGNED NOT NULL DEFAULT 1,
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  last_error_code VARCHAR(64),
  last_error_message VARCHAR(1024),
  started_at DATETIME(6),
  completed_at DATETIME(6),
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sls_diag_task (diagnosis_id, question_id, diagnosis_model_id),
  KEY idx_sls_diag_task_status (diagnosis_id, status, id),
  KEY idx_sls_diag_task_question (question_id),
  KEY idx_sls_diag_task_model (diagnosis_model_id),
  CONSTRAINT fk_sls_diag_task_diag FOREIGN KEY (diagnosis_id) REFERENCES sls_diagnoses(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_sls_diag_task_question FOREIGN KEY (question_id) REFERENCES sls_diagnosis_questions(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_sls_diag_task_model FOREIGN KEY (diagnosis_model_id) REFERENCES sls_diagnosis_models(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT chk_sls_diag_task_status CHECK (status IN (1,2,3,4,5))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sls_diagnosis_results (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  task_id BIGINT UNSIGNED NOT NULL,
  attempt_no INT UNSIGNED NOT NULL,
  succeeded BOOLEAN NOT NULL DEFAULT FALSE,
  answer LONGTEXT,
  raw_response_json JSON,
  provider_request_id VARCHAR(255),
  response_model VARCHAR(128),
  prompt_snapshot LONGTEXT,
  evidence_type TINYINT UNSIGNED NOT NULL DEFAULT 1,
  input_tokens BIGINT UNSIGNED NOT NULL DEFAULT 0,
  output_tokens BIGINT UNSIGNED NOT NULL DEFAULT 0,
  cost_micros BIGINT NOT NULL DEFAULT 0,
  duration_ms BIGINT UNSIGNED NOT NULL DEFAULT 0,
  brand_mentioned BOOLEAN NOT NULL DEFAULT FALSE,
  brand_position INT NOT NULL DEFAULT 0,
  error_code VARCHAR(64),
  error_message VARCHAR(1024),
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sls_diag_result_attempt (task_id, attempt_no),
  KEY idx_sls_diag_result_success (task_id, succeeded, created_at),
  CONSTRAINT fk_sls_diag_result_task FOREIGN KEY (task_id) REFERENCES sls_diagnosis_tasks(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT chk_sls_diag_evidence CHECK (evidence_type IN (1,2))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sls_diagnosis_citations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  result_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(512),
  url VARCHAR(2048) NOT NULL,
  domain VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_sls_diag_citation_sort (result_id, sort_order, id),
  KEY idx_sls_diag_citation_domain (domain),
  CONSTRAINT fk_sls_diag_citation_result FOREIGN KEY (result_id) REFERENCES sls_diagnosis_results(id) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sls_diagnosis_competitor_mentions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  result_id BIGINT UNSIGNED NOT NULL,
  competitor_name VARCHAR(128) NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sls_diag_competitor (result_id, competitor_name),
  KEY idx_sls_diag_competitor_name (competitor_name),
  CONSTRAINT fk_sls_diag_comp_result FOREIGN KEY (result_id) REFERENCES sls_diagnosis_results(id) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sls_diagnosis_metrics (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  diagnosis_id BIGINT UNSIGNED NOT NULL,
  diagnosis_model_id BIGINT UNSIGNED,
  metric_code VARCHAR(64) NOT NULL,
  numerator BIGINT NOT NULL DEFAULT 0,
  denominator BIGINT NOT NULL DEFAULT 0,
  value DECIMAL(12,6) NOT NULL DEFAULT 0,
  sample_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sls_diag_metric (diagnosis_id, diagnosis_model_id, metric_code),
  KEY idx_sls_diag_metric_code (diagnosis_id, metric_code),
  KEY idx_sls_diag_metric_model (diagnosis_model_id),
  CONSTRAINT fk_sls_diag_metric_diag FOREIGN KEY (diagnosis_id) REFERENCES sls_diagnoses(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_sls_diag_metric_model FOREIGN KEY (diagnosis_model_id) REFERENCES sls_diagnosis_models(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT chk_sls_diag_metric_denominator CHECK (denominator >= 0),
  CONSTRAINT chk_sls_diag_metric_sample CHECK (sample_count >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
