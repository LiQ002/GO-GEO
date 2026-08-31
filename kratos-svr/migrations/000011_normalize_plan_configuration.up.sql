CREATE TABLE IF NOT EXISTS ent_plan_limits (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  plan_id BIGINT UNSIGNED NOT NULL,
  metric VARCHAR(64) NOT NULL,
  limit_value BIGINT NOT NULL,
  period VARCHAR(32) NOT NULL DEFAULT 'monthly',
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_ent_plan_limit (plan_id, metric),
  KEY idx_ent_plan_limit_plan (plan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ent_plan_features (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  plan_id BIGINT UNSIGNED NOT NULL,
  feature VARCHAR(64) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_ent_plan_feature (plan_id, feature),
  KEY idx_ent_plan_feature_plan (plan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO ent_plan_limits (plan_id, metric, limit_value, period, created_at, updated_at)
SELECT
  p.id,
  limit_keys.metric,
  CAST(JSON_UNQUOTE(JSON_EXTRACT(p.limits_json, CONCAT('$."', limit_keys.metric, '"'))) AS SIGNED),
  'monthly',
  CURRENT_TIMESTAMP(6),
  CURRENT_TIMESTAMP(6)
FROM ent_plans p
JOIN JSON_TABLE(
  JSON_KEYS(COALESCE(p.limits_json, JSON_OBJECT())),
  '$[*]' COLUMNS(metric VARCHAR(64) PATH '$')
) AS limit_keys
WHERE JSON_TYPE(JSON_EXTRACT(p.limits_json, CONCAT('$."', limit_keys.metric, '"'))) IN ('INTEGER', 'DOUBLE');

INSERT IGNORE INTO ent_plan_features (plan_id, feature, enabled, created_at, updated_at)
SELECT
  p.id,
  feature_keys.feature,
  JSON_UNQUOTE(JSON_EXTRACT(p.features_json, CONCAT('$."', feature_keys.feature, '"'))) IN ('true', '1'),
  CURRENT_TIMESTAMP(6),
  CURRENT_TIMESTAMP(6)
FROM ent_plans p
JOIN JSON_TABLE(
  JSON_KEYS(COALESCE(p.features_json, JSON_OBJECT())),
  '$[*]' COLUMNS(feature VARCHAR(64) PATH '$')
) AS feature_keys;

ALTER TABLE ent_plans
  DROP COLUMN limits_json,
  DROP COLUMN features_json;
