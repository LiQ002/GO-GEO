ALTER TABLE cfg_writing_models
  ADD COLUMN purposes_json JSON NULL AFTER sort_order,
  ADD COLUMN parameters_json JSON NULL AFTER purposes_json,
  ADD COLUMN safety_json JSON NULL AFTER parameters_json,
  ADD COLUMN pricing_json JSON NULL AFTER safety_json,
  ADD COLUMN visibility_json JSON NULL AFTER pricing_json;

UPDATE cfg_writing_models AS wm
SET purposes_json = COALESCE(
      (SELECT JSON_ARRAYAGG(purpose) FROM cfg_writing_model_purposes WHERE writing_model_id = wm.id),
      JSON_ARRAY()
    ),
    parameters_json = JSON_OBJECT(
      'temperature', temperature,
      'top_p', top_p,
      'max_tokens', max_tokens,
      'timeout_seconds', timeout_seconds
    ),
    safety_json = JSON_OBJECT(
      'enabled', safety_enabled,
      'input_moderation_enabled', input_moderation_enabled,
      'output_moderation_enabled', output_moderation_enabled,
      'fail_closed', safety_fail_closed,
      'blocked_categories', COALESCE(
        (SELECT JSON_ARRAYAGG(category) FROM cfg_writing_model_safety_rules WHERE writing_model_id = wm.id),
        JSON_ARRAY()
      )
    ),
    pricing_json = JSON_OBJECT(
      'input_micros_per_million_tokens', input_price_micros_per_million_tokens,
      'output_micros_per_million_tokens', output_price_micros_per_million_tokens,
      'currency', price_currency
    ),
    visibility_json = JSON_OBJECT(
      'access_scope', access_scope,
      'plan_ids', COALESCE(
        (SELECT JSON_ARRAYAGG(plan_id) FROM cfg_writing_model_plan_scopes WHERE writing_model_id = wm.id),
        JSON_ARRAY()
      ),
      'enterprise_ids', COALESCE(
        (SELECT JSON_ARRAYAGG(enterprise_id) FROM cfg_writing_model_enterprise_scopes WHERE writing_model_id = wm.id),
        JSON_ARRAY()
      )
    );

ALTER TABLE cfg_writing_models
  MODIFY purposes_json JSON NOT NULL,
  MODIFY parameters_json JSON NOT NULL;

DROP TABLE cfg_writing_model_enterprise_scopes;
DROP TABLE cfg_writing_model_plan_scopes;
DROP TABLE cfg_writing_model_safety_rules;
DROP TABLE cfg_writing_model_purposes;

ALTER TABLE cfg_writing_models
  DROP KEY idx_cfg_writing_model_access_scope,
  DROP COLUMN access_scope,
  DROP COLUMN price_currency,
  DROP COLUMN output_price_micros_per_million_tokens,
  DROP COLUMN input_price_micros_per_million_tokens,
  DROP COLUMN safety_fail_closed,
  DROP COLUMN output_moderation_enabled,
  DROP COLUMN input_moderation_enabled,
  DROP COLUMN safety_enabled,
  DROP COLUMN timeout_seconds,
  DROP COLUMN max_tokens,
  DROP COLUMN top_p,
  DROP COLUMN temperature;
