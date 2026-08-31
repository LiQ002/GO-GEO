ALTER TABLE ent_plans
  ADD COLUMN limits_json JSON,
  ADD COLUMN features_json JSON;

UPDATE ent_plans p
LEFT JOIN (
  SELECT plan_id, JSON_OBJECTAGG(metric, limit_value) AS limits_json
  FROM ent_plan_limits
  GROUP BY plan_id
) l ON l.plan_id = p.id
LEFT JOIN (
  SELECT plan_id, JSON_OBJECTAGG(feature, enabled) AS features_json
  FROM ent_plan_features
  GROUP BY plan_id
) f ON f.plan_id = p.id
SET
  p.limits_json = COALESCE(l.limits_json, JSON_OBJECT()),
  p.features_json = COALESCE(f.features_json, JSON_OBJECT());

ALTER TABLE ent_plans
  MODIFY COLUMN limits_json JSON NOT NULL,
  MODIFY COLUMN features_json JSON NOT NULL;

DROP TABLE IF EXISTS ent_plan_features;
DROP TABLE IF EXISTS ent_plan_limits;
