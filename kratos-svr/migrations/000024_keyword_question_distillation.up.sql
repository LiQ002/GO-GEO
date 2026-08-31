ALTER TABLE cnt_keywords
  ADD COLUMN region VARCHAR(128) NULL AFTER text,
  ADD COLUMN requested_question_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER priority,
  ADD COLUMN distilled_question_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER requested_question_count,
  ADD COLUMN distillation_status TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER distilled_question_count,
  ADD COLUMN last_distillation_task_id BIGINT UNSIGNED NULL AFTER distillation_status,
  ADD COLUMN distillation_error TEXT NULL AFTER last_distillation_task_id,
  ADD KEY idx_keyword_distillation_status (enterprise_id, distillation_status, updated_at);

ALTER TABLE cnt_questions
  ADD COLUMN region VARCHAR(128) NULL AFTER text,
  ADD COLUMN source TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER region,
  ADD COLUMN distillation_task_id BIGINT UNSIGNED NULL AFTER source,
  ADD KEY idx_question_distillation_task (enterprise_id, distillation_task_id);

CREATE TABLE IF NOT EXISTS cnt_keyword_distillation_tasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enterprise_id BIGINT UNSIGNED NOT NULL,
  keyword_id BIGINT UNSIGNED NOT NULL,
  brand_id BIGINT UNSIGNED NOT NULL,
  writing_model_id BIGINT UNSIGNED NOT NULL,
  writing_model_version BIGINT UNSIGNED NOT NULL,
  client_request_id VARCHAR(128) NOT NULL,
  status TINYINT UNSIGNED NOT NULL,
  region VARCHAR(128) NULL,
  requested_count INT UNSIGNED NOT NULL,
  prompt_snapshot LONGTEXT NOT NULL,
  model_snapshot_json JSON NOT NULL,
  output_json JSON NULL,
  input_tokens BIGINT UNSIGNED NOT NULL DEFAULT 0,
  output_tokens BIGINT UNSIGNED NOT NULL DEFAULT 0,
  cost_micros BIGINT NOT NULL DEFAULT 0,
  error_code VARCHAR(64) NULL,
  error_message TEXT NULL,
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  started_at DATETIME(6) NULL,
  completed_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  deleted_at DATETIME(6) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_keyword_distillation_request (enterprise_id, client_request_id),
  KEY idx_keyword_distillation_keyword (enterprise_id, keyword_id, created_at),
  KEY idx_keyword_distillation_status (enterprise_id, status, created_at),
  KEY idx_keyword_distillation_model (writing_model_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
