ALTER TABLE cfg_article_type_versions
  MODIFY COLUMN prompt_version_id BIGINT UNSIGNED NULL,
  ADD COLUMN system_prompt LONGTEXT NULL AFTER quality_rules_json,
  ADD COLUMN user_prompt_template LONGTEXT NULL AFTER system_prompt,
  ADD COLUMN output_format TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER user_prompt_template;

ALTER TABLE cnt_article_generation_tasks
  MODIFY COLUMN prompt_version_id BIGINT UNSIGNED NULL;

CREATE TABLE IF NOT EXISTS cfg_article_type_sections (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  article_type_version_id BIGINT UNSIGNED NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  title VARCHAR(255) NOT NULL,
  guidance TEXT,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_cfg_article_type_section (article_type_version_id, sort_order),
  CONSTRAINT fk_cfg_article_type_section_version
    FOREIGN KEY (article_type_version_id) REFERENCES cfg_article_type_versions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cfg_article_type_input_fields (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  article_type_version_id BIGINT UNSIGNED NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  field_key VARCHAR(64) NOT NULL,
  label VARCHAR(128) NOT NULL,
  input_type TINYINT UNSIGNED NOT NULL,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  placeholder VARCHAR(512),
  help_text VARCHAR(1024),
  default_value TEXT,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_cfg_article_type_input_key (article_type_version_id, field_key),
  KEY idx_cfg_article_type_input_order (article_type_version_id, sort_order),
  CONSTRAINT fk_cfg_article_type_input_version
    FOREIGN KEY (article_type_version_id) REFERENCES cfg_article_type_versions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cfg_article_type_input_options (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  article_type_input_field_id BIGINT UNSIGNED NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  option_value VARCHAR(255) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_cfg_article_type_input_option (article_type_input_field_id, option_value),
  KEY idx_cfg_article_type_option_order (article_type_input_field_id, sort_order),
  CONSTRAINT fk_cfg_article_type_option_field
    FOREIGN KEY (article_type_input_field_id) REFERENCES cfg_article_type_input_fields (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cfg_article_type_rules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  article_type_version_id BIGINT UNSIGNED NOT NULL,
  rule_type TINYINT UNSIGNED NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  rule_text TEXT NOT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_cfg_article_type_rule (article_type_version_id, rule_type, sort_order),
  CONSTRAINT fk_cfg_article_type_rule_version
    FOREIGN KEY (article_type_version_id) REFERENCES cfg_article_type_versions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cfg_article_type_models (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  article_type_version_id BIGINT UNSIGNED NOT NULL,
  writing_model_id BIGINT UNSIGNED NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_cfg_article_type_model (article_type_version_id, writing_model_id),
  KEY idx_cfg_article_type_model_order (article_type_version_id, sort_order),
  CONSTRAINT fk_cfg_article_type_model_version
    FOREIGN KEY (article_type_version_id) REFERENCES cfg_article_type_versions (id) ON DELETE CASCADE,
  CONSTRAINT fk_cfg_article_type_model_model
    FOREIGN KEY (writing_model_id) REFERENCES cfg_writing_models (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cfg_article_type_version_channels (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  article_type_version_id BIGINT UNSIGNED NOT NULL,
  publish_channel_id BIGINT UNSIGNED NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_cfg_article_type_version_channel (article_type_version_id, publish_channel_id),
  KEY idx_cfg_article_type_channel_order (article_type_version_id, sort_order),
  CONSTRAINT fk_cfg_article_type_channel_version
    FOREIGN KEY (article_type_version_id) REFERENCES cfg_article_type_versions (id) ON DELETE CASCADE,
  CONSTRAINT fk_cfg_article_type_channel_channel
    FOREIGN KEY (publish_channel_id) REFERENCES cfg_publish_channels (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
