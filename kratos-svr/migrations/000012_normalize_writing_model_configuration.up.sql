ALTER TABLE cfg_writing_models
  ADD COLUMN temperature DECIMAL(4,3) NOT NULL DEFAULT 0.700 AFTER sort_order,
  ADD COLUMN top_p DECIMAL(4,3) NOT NULL DEFAULT 1.000 AFTER temperature,
  ADD COLUMN max_tokens INT UNSIGNED NOT NULL DEFAULT 4096 AFTER top_p,
  ADD COLUMN timeout_seconds INT UNSIGNED NOT NULL DEFAULT 120 AFTER max_tokens,
  ADD COLUMN safety_enabled BOOLEAN NOT NULL DEFAULT FALSE AFTER timeout_seconds,
  ADD COLUMN input_moderation_enabled BOOLEAN NOT NULL DEFAULT FALSE AFTER safety_enabled,
  ADD COLUMN output_moderation_enabled BOOLEAN NOT NULL DEFAULT FALSE AFTER input_moderation_enabled,
  ADD COLUMN safety_fail_closed BOOLEAN NOT NULL DEFAULT TRUE AFTER output_moderation_enabled,
  ADD COLUMN input_price_micros_per_million_tokens BIGINT NOT NULL DEFAULT 0 AFTER safety_fail_closed,
  ADD COLUMN output_price_micros_per_million_tokens BIGINT NOT NULL DEFAULT 0 AFTER input_price_micros_per_million_tokens,
  ADD COLUMN price_currency CHAR(3) NOT NULL DEFAULT 'CNY' AFTER output_price_micros_per_million_tokens,
  ADD COLUMN access_scope VARCHAR(32) NOT NULL DEFAULT 'all' AFTER price_currency,
  ADD KEY idx_cfg_writing_model_access_scope(access_scope);

CREATE TABLE cfg_writing_model_purposes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  writing_model_id BIGINT UNSIGNED NOT NULL,
  purpose VARCHAR(64) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY(id),
  UNIQUE KEY uk_cfg_writing_model_purpose(writing_model_id, purpose),
  KEY idx_cfg_writing_model_purpose_model(writing_model_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cfg_writing_model_safety_rules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  writing_model_id BIGINT UNSIGNED NOT NULL,
  category VARCHAR(64) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY(id),
  UNIQUE KEY uk_cfg_writing_model_safety(writing_model_id, category),
  KEY idx_cfg_writing_model_safety_model(writing_model_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cfg_writing_model_plan_scopes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  writing_model_id BIGINT UNSIGNED NOT NULL,
  plan_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY(id),
  UNIQUE KEY uk_cfg_writing_model_plan_scope(writing_model_id, plan_id),
  KEY idx_cfg_writing_model_plan_scope_model(writing_model_id),
  KEY idx_cfg_writing_model_plan_scope_plan(plan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cfg_writing_model_enterprise_scopes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  writing_model_id BIGINT UNSIGNED NOT NULL,
  enterprise_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY(id),
  UNIQUE KEY uk_cfg_writing_model_enterprise_scope(writing_model_id, enterprise_id),
  KEY idx_cfg_writing_model_enterprise_scope_model(writing_model_id),
  KEY idx_cfg_writing_model_enterprise_scope_enterprise(enterprise_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

UPDATE cfg_writing_models
SET temperature = COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(parameters_json, '$.temperature')) AS DECIMAL(4,3)), 0.700),
    top_p = COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(parameters_json, '$.top_p')) AS DECIMAL(4,3)), 1.000),
    max_tokens = COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(parameters_json, '$.max_tokens')) AS UNSIGNED), 4096),
    timeout_seconds = COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(parameters_json, '$.timeout_seconds')) AS UNSIGNED), 120),
    safety_enabled = COALESCE(JSON_UNQUOTE(JSON_EXTRACT(safety_json, '$.enabled')) = 'true', FALSE),
    input_moderation_enabled = COALESCE(JSON_UNQUOTE(JSON_EXTRACT(safety_json, '$.input_moderation_enabled')) = 'true', FALSE),
    output_moderation_enabled = COALESCE(JSON_UNQUOTE(JSON_EXTRACT(safety_json, '$.output_moderation_enabled')) = 'true', FALSE),
    safety_fail_closed = COALESCE(JSON_UNQUOTE(JSON_EXTRACT(safety_json, '$.fail_closed')) = 'true', TRUE),
    input_price_micros_per_million_tokens = COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(pricing_json, '$.input_micros_per_million_tokens')) AS SIGNED), 0),
    output_price_micros_per_million_tokens = COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(pricing_json, '$.output_micros_per_million_tokens')) AS SIGNED), 0),
    price_currency = COALESCE(NULLIF(UPPER(JSON_UNQUOTE(JSON_EXTRACT(pricing_json, '$.currency'))), ''), 'CNY'),
    access_scope = CASE
      WHEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT(visibility_json, '$.access_scope')), JSON_UNQUOTE(JSON_EXTRACT(visibility_json, '$.scope'))) = 'restricted' THEN 'restricted'
      WHEN COALESCE(JSON_LENGTH(JSON_EXTRACT(visibility_json, '$.plan_ids')), 0) > 0 THEN 'restricted'
      WHEN COALESCE(JSON_LENGTH(JSON_EXTRACT(visibility_json, '$.enterprise_ids')), 0) > 0 THEN 'restricted'
      ELSE 'all'
    END;

INSERT IGNORE INTO cfg_writing_model_purposes (writing_model_id, purpose, created_at, updated_at)
SELECT wm.id, purpose_rows.purpose, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)
FROM cfg_writing_models AS wm
JOIN JSON_TABLE(COALESCE(wm.purposes_json, JSON_ARRAY()), '$[*]' COLUMNS (purpose VARCHAR(64) PATH '$')) AS purpose_rows
WHERE purpose_rows.purpose <> '';

INSERT IGNORE INTO cfg_writing_model_safety_rules (writing_model_id, category, created_at, updated_at)
SELECT wm.id, category_rows.category, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)
FROM cfg_writing_models AS wm
JOIN JSON_TABLE(COALESCE(JSON_EXTRACT(wm.safety_json, '$.blocked_categories'), JSON_ARRAY()), '$[*]' COLUMNS (category VARCHAR(64) PATH '$')) AS category_rows
WHERE category_rows.category <> '';

INSERT IGNORE INTO cfg_writing_model_plan_scopes (writing_model_id, plan_id, created_at, updated_at)
SELECT wm.id, plan_rows.plan_id, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)
FROM cfg_writing_models AS wm
JOIN JSON_TABLE(COALESCE(JSON_EXTRACT(wm.visibility_json, '$.plan_ids'), JSON_ARRAY()), '$[*]' COLUMNS (plan_id BIGINT UNSIGNED PATH '$')) AS plan_rows
WHERE plan_rows.plan_id > 0;

INSERT IGNORE INTO cfg_writing_model_enterprise_scopes (writing_model_id, enterprise_id, created_at, updated_at)
SELECT wm.id, enterprise_rows.enterprise_id, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)
FROM cfg_writing_models AS wm
JOIN JSON_TABLE(COALESCE(JSON_EXTRACT(wm.visibility_json, '$.enterprise_ids'), JSON_ARRAY()), '$[*]' COLUMNS (enterprise_id BIGINT UNSIGNED PATH '$')) AS enterprise_rows
WHERE enterprise_rows.enterprise_id > 0;

ALTER TABLE cfg_writing_models
  DROP COLUMN purposes_json,
  DROP COLUMN parameters_json,
  DROP COLUMN safety_json,
  DROP COLUMN pricing_json,
  DROP COLUMN visibility_json;
