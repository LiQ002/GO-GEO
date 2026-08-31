UPDATE ent_plans SET status = CASE status WHEN 'active' THEN '1' WHEN 'disabled' THEN '2' WHEN 'archived' THEN '3' ELSE status END;
ALTER TABLE ent_plans MODIFY COLUMN status TINYINT UNSIGNED NOT NULL;
UPDATE ent_plan_limits SET metric = CASE metric WHEN 'article_generations' THEN '1' WHEN 'publish_tasks' THEN '2' WHEN 'geo_queries' THEN '3' WHEN 'knowledge_bytes' THEN '4' WHEN 'ai_tokens' THEN '5' ELSE metric END;
UPDATE ent_plan_limits SET period = CASE period WHEN 'daily' THEN '1' WHEN 'monthly' THEN '2' WHEN 'yearly' THEN '3' WHEN 'total' THEN '4' ELSE period END;
ALTER TABLE ent_plan_limits MODIFY COLUMN metric TINYINT UNSIGNED NOT NULL;
ALTER TABLE ent_plan_limits MODIFY COLUMN period TINYINT UNSIGNED NOT NULL;
UPDATE ent_plan_features SET feature = CASE feature WHEN 'article_generation' THEN '1' WHEN 'knowledge_management' THEN '2' WHEN 'publish_management' THEN '3' WHEN 'geo_monitoring' THEN '4' WHEN 'data_export' THEN '5' ELSE feature END;
ALTER TABLE ent_plan_features MODIFY COLUMN feature TINYINT UNSIGNED NOT NULL;

UPDATE adm_roles SET data_scope = CASE data_scope WHEN 'all' THEN '1' WHEN 'assigned' THEN '2' WHEN 'readonly' THEN '3' ELSE data_scope END;
UPDATE adm_roles SET status = CASE status WHEN 'active' THEN '1' WHEN 'disabled' THEN '2' ELSE status END;
ALTER TABLE adm_roles MODIFY COLUMN data_scope TINYINT UNSIGNED NOT NULL;
ALTER TABLE adm_roles MODIFY COLUMN status TINYINT UNSIGNED NOT NULL;

UPDATE cfg_article_types SET source_type = CASE source_type WHEN 'system' THEN '1' WHEN 'custom' THEN '2' ELSE source_type END;
UPDATE cfg_article_types SET status = CASE status WHEN 'draft' THEN '1' WHEN 'active' THEN '2' WHEN 'disabled' THEN '3' WHEN 'archived' THEN '4' ELSE status END;
ALTER TABLE cfg_article_types MODIFY COLUMN source_type TINYINT UNSIGNED NOT NULL;
ALTER TABLE cfg_article_types MODIFY COLUMN status TINYINT UNSIGNED NOT NULL;
UPDATE cfg_article_type_versions SET status = CASE status WHEN 'draft' THEN '1' WHEN 'published' THEN '2' ELSE status END;
ALTER TABLE cfg_article_type_versions MODIFY COLUMN status TINYINT UNSIGNED NOT NULL;

UPDATE cfg_publish_channels SET category = CASE category WHEN 'self_media' THEN '1' WHEN 'official_media' THEN '2' WHEN 'kol' THEN '3' ELSE category END;
UPDATE cfg_publish_channels SET status = CASE status WHEN 'active' THEN '1' WHEN 'disabled' THEN '2' WHEN 'maintenance' THEN '3' ELSE status END;
UPDATE cfg_publish_channels SET authorization_type = CASE authorization_type WHEN 'none' THEN '1' WHEN 'client_login' THEN '2' ELSE authorization_type END;
UPDATE cfg_publish_channels SET execution_mode = CASE execution_mode WHEN 'automatic' THEN '1' WHEN 'semi_automatic' THEN '2' WHEN 'manual' THEN '3' ELSE execution_mode END;
ALTER TABLE cfg_publish_channels MODIFY COLUMN category TINYINT UNSIGNED NOT NULL;
ALTER TABLE cfg_publish_channels MODIFY COLUMN status TINYINT UNSIGNED NOT NULL;
ALTER TABLE cfg_publish_channels MODIFY COLUMN authorization_type TINYINT UNSIGNED NOT NULL;
ALTER TABLE cfg_publish_channels MODIFY COLUMN execution_mode TINYINT UNSIGNED NOT NULL;
UPDATE cfg_publish_targets SET target_type = CASE target_type WHEN 'official_media' THEN '2' WHEN 'kol' THEN '3' ELSE target_type END;
UPDATE cfg_publish_targets SET status = CASE status WHEN 'active' THEN '1' WHEN 'disabled' THEN '2' ELSE status END;
ALTER TABLE cfg_publish_targets MODIFY COLUMN target_type TINYINT UNSIGNED NOT NULL;
ALTER TABLE cfg_publish_targets MODIFY COLUMN status TINYINT UNSIGNED NOT NULL;

UPDATE cfg_inclusion_sites SET status = CASE status WHEN 'active' THEN '1' WHEN 'disabled' THEN '2' WHEN 'maintenance' THEN '3' ELSE status END;
UPDATE cfg_inclusion_sites SET authorization_type = CASE authorization_type WHEN 'none' THEN '1' WHEN 'client_login' THEN '2' ELSE authorization_type END;
ALTER TABLE cfg_inclusion_sites MODIFY COLUMN status TINYINT UNSIGNED NOT NULL;
ALTER TABLE cfg_inclusion_sites MODIFY COLUMN authorization_type TINYINT UNSIGNED NOT NULL;

UPDATE cfg_writing_models SET provider = CASE provider WHEN 'qwen' THEN '1' WHEN 'deepseek' THEN '2' WHEN 'kimi' THEN '3' WHEN 'openai' THEN '4' WHEN 'custom' THEN '5' ELSE provider END;
UPDATE cfg_writing_models SET protocol = CASE protocol WHEN 'openai_compatible' THEN '1' ELSE protocol END;
UPDATE cfg_writing_models SET status = CASE status WHEN 'active' THEN '1' WHEN 'disabled' THEN '2' ELSE status END;
UPDATE cfg_writing_models SET price_currency = CASE price_currency WHEN 'CNY' THEN '1' WHEN 'USD' THEN '2' ELSE price_currency END;
UPDATE cfg_writing_models SET access_scope = CASE access_scope WHEN 'all' THEN '1' WHEN 'restricted' THEN '2' ELSE access_scope END;
ALTER TABLE cfg_writing_models MODIFY COLUMN provider TINYINT UNSIGNED NOT NULL;
ALTER TABLE cfg_writing_models MODIFY COLUMN protocol TINYINT UNSIGNED NOT NULL;
ALTER TABLE cfg_writing_models MODIFY COLUMN status TINYINT UNSIGNED NOT NULL;
ALTER TABLE cfg_writing_models MODIFY COLUMN price_currency TINYINT UNSIGNED NOT NULL DEFAULT 1;
ALTER TABLE cfg_writing_models MODIFY COLUMN access_scope TINYINT UNSIGNED NOT NULL DEFAULT 1;
UPDATE cfg_writing_model_purposes SET purpose = CASE purpose WHEN 'outline' THEN '1' WHEN 'article' THEN '2' WHEN 'rewrite' THEN '3' WHEN 'summary' THEN '4' WHEN 'question_extraction' THEN '5' ELSE purpose END;
ALTER TABLE cfg_writing_model_purposes MODIFY COLUMN purpose TINYINT UNSIGNED NOT NULL;
UPDATE cfg_writing_model_safety_rules SET category = CASE category WHEN 'illegal' THEN '1' WHEN 'violence' THEN '2' WHEN 'adult' THEN '3' WHEN 'hate' THEN '4' WHEN 'self_harm' THEN '5' WHEN 'personal_data' THEN '6' ELSE category END;
ALTER TABLE cfg_writing_model_safety_rules MODIFY COLUMN category TINYINT UNSIGNED NOT NULL;
