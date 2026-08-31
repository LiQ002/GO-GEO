ALTER TABLE ent_plans MODIFY COLUMN status VARCHAR(32) NOT NULL;
UPDATE ent_plans SET status = CASE status WHEN '1' THEN 'active' WHEN '2' THEN 'disabled' WHEN '3' THEN 'archived' ELSE status END;
ALTER TABLE ent_plan_limits MODIFY COLUMN metric VARCHAR(64) NOT NULL;
ALTER TABLE ent_plan_limits MODIFY COLUMN period VARCHAR(32) NOT NULL;
UPDATE ent_plan_limits SET metric = CASE metric WHEN '1' THEN 'article_generations' WHEN '2' THEN 'publish_tasks' WHEN '3' THEN 'geo_queries' WHEN '4' THEN 'knowledge_bytes' WHEN '5' THEN 'ai_tokens' ELSE metric END;
UPDATE ent_plan_limits SET period = CASE period WHEN '1' THEN 'daily' WHEN '2' THEN 'monthly' WHEN '3' THEN 'yearly' WHEN '4' THEN 'total' ELSE period END;
ALTER TABLE ent_plan_features MODIFY COLUMN feature VARCHAR(64) NOT NULL;
UPDATE ent_plan_features SET feature = CASE feature WHEN '1' THEN 'article_generation' WHEN '2' THEN 'knowledge_management' WHEN '3' THEN 'publish_management' WHEN '4' THEN 'geo_monitoring' WHEN '5' THEN 'data_export' ELSE feature END;

ALTER TABLE adm_roles MODIFY COLUMN data_scope VARCHAR(32) NOT NULL;
ALTER TABLE adm_roles MODIFY COLUMN status VARCHAR(32) NOT NULL;
UPDATE adm_roles SET data_scope = CASE data_scope WHEN '1' THEN 'all' WHEN '2' THEN 'assigned' WHEN '3' THEN 'readonly' ELSE data_scope END;
UPDATE adm_roles SET status = CASE status WHEN '1' THEN 'active' WHEN '2' THEN 'disabled' ELSE status END;

ALTER TABLE cfg_article_types MODIFY COLUMN source_type VARCHAR(32) NOT NULL;
ALTER TABLE cfg_article_types MODIFY COLUMN status VARCHAR(32) NOT NULL;
UPDATE cfg_article_types SET source_type = CASE source_type WHEN '1' THEN 'system' WHEN '2' THEN 'custom' ELSE source_type END;
UPDATE cfg_article_types SET status = CASE status WHEN '1' THEN 'draft' WHEN '2' THEN 'active' WHEN '3' THEN 'disabled' WHEN '4' THEN 'archived' ELSE status END;
ALTER TABLE cfg_article_type_versions MODIFY COLUMN status VARCHAR(32) NOT NULL;
UPDATE cfg_article_type_versions SET status = CASE status WHEN '1' THEN 'draft' WHEN '2' THEN 'published' ELSE status END;

ALTER TABLE cfg_publish_channels MODIFY COLUMN category VARCHAR(32) NOT NULL;
ALTER TABLE cfg_publish_channels MODIFY COLUMN status VARCHAR(32) NOT NULL;
ALTER TABLE cfg_publish_channels MODIFY COLUMN authorization_type VARCHAR(32) NOT NULL;
ALTER TABLE cfg_publish_channels MODIFY COLUMN execution_mode VARCHAR(32) NOT NULL;
UPDATE cfg_publish_channels SET category = CASE category WHEN '1' THEN 'self_media' WHEN '2' THEN 'official_media' WHEN '3' THEN 'kol' ELSE category END;
UPDATE cfg_publish_channels SET status = CASE status WHEN '1' THEN 'active' WHEN '2' THEN 'disabled' WHEN '3' THEN 'maintenance' ELSE status END;
UPDATE cfg_publish_channels SET authorization_type = CASE authorization_type WHEN '1' THEN 'none' WHEN '2' THEN 'client_login' ELSE authorization_type END;
UPDATE cfg_publish_channels SET execution_mode = CASE execution_mode WHEN '1' THEN 'automatic' WHEN '2' THEN 'semi_automatic' WHEN '3' THEN 'manual' ELSE execution_mode END;
ALTER TABLE cfg_publish_targets MODIFY COLUMN target_type VARCHAR(32) NOT NULL;
ALTER TABLE cfg_publish_targets MODIFY COLUMN status VARCHAR(32) NOT NULL;
UPDATE cfg_publish_targets SET target_type = CASE target_type WHEN '2' THEN 'official_media' WHEN '3' THEN 'kol' ELSE target_type END;
UPDATE cfg_publish_targets SET status = CASE status WHEN '1' THEN 'active' WHEN '2' THEN 'disabled' ELSE status END;

ALTER TABLE cfg_inclusion_sites MODIFY COLUMN status VARCHAR(32) NOT NULL;
ALTER TABLE cfg_inclusion_sites MODIFY COLUMN authorization_type VARCHAR(32) NOT NULL;
UPDATE cfg_inclusion_sites SET status = CASE status WHEN '1' THEN 'active' WHEN '2' THEN 'disabled' WHEN '3' THEN 'maintenance' ELSE status END;
UPDATE cfg_inclusion_sites SET authorization_type = CASE authorization_type WHEN '1' THEN 'none' WHEN '2' THEN 'client_login' ELSE authorization_type END;

ALTER TABLE cfg_writing_models MODIFY COLUMN provider VARCHAR(64) NOT NULL;
ALTER TABLE cfg_writing_models MODIFY COLUMN protocol VARCHAR(32) NOT NULL;
ALTER TABLE cfg_writing_models MODIFY COLUMN status VARCHAR(32) NOT NULL;
ALTER TABLE cfg_writing_models MODIFY COLUMN price_currency CHAR(3) NOT NULL DEFAULT 'CNY';
ALTER TABLE cfg_writing_models MODIFY COLUMN access_scope VARCHAR(32) NOT NULL DEFAULT 'all';
UPDATE cfg_writing_models SET provider = CASE provider WHEN '1' THEN 'qwen' WHEN '2' THEN 'deepseek' WHEN '3' THEN 'kimi' WHEN '4' THEN 'openai' WHEN '5' THEN 'custom' ELSE provider END;
UPDATE cfg_writing_models SET protocol = CASE protocol WHEN '1' THEN 'openai_compatible' ELSE protocol END;
UPDATE cfg_writing_models SET status = CASE status WHEN '1' THEN 'active' WHEN '2' THEN 'disabled' ELSE status END;
UPDATE cfg_writing_models SET price_currency = CASE price_currency WHEN '1' THEN 'CNY' WHEN '2' THEN 'USD' ELSE price_currency END;
UPDATE cfg_writing_models SET access_scope = CASE access_scope WHEN '1' THEN 'all' WHEN '2' THEN 'restricted' ELSE access_scope END;
ALTER TABLE cfg_writing_model_purposes MODIFY COLUMN purpose VARCHAR(64) NOT NULL;
UPDATE cfg_writing_model_purposes SET purpose = CASE purpose WHEN '1' THEN 'outline' WHEN '2' THEN 'article' WHEN '3' THEN 'rewrite' WHEN '4' THEN 'summary' WHEN '5' THEN 'question_extraction' ELSE purpose END;
ALTER TABLE cfg_writing_model_safety_rules MODIFY COLUMN category VARCHAR(64) NOT NULL;
UPDATE cfg_writing_model_safety_rules SET category = CASE category WHEN '1' THEN 'illegal' WHEN '2' THEN 'violence' WHEN '3' THEN 'adult' WHEN '4' THEN 'hate' WHEN '5' THEN 'self_harm' WHEN '6' THEN 'personal_data' ELSE category END;
