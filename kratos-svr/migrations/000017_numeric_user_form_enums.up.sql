UPDATE cnt_brands SET status = CASE status WHEN 'active' THEN '1' WHEN 'archived' THEN '2' ELSE status END;
ALTER TABLE cnt_brands MODIFY COLUMN status TINYINT UNSIGNED NOT NULL;

UPDATE kb_bases SET status = CASE status WHEN 'active' THEN '1' WHEN 'archived' THEN '2' ELSE status END;
ALTER TABLE kb_bases MODIFY COLUMN status TINYINT UNSIGNED NOT NULL;

UPDATE kb_documents SET source_type = CASE source_type WHEN 'text' THEN '1' WHEN 'url' THEN '2' WHEN 'file' THEN '3' ELSE source_type END;
UPDATE kb_documents SET parse_status = CASE parse_status WHEN 'pending' THEN '1' WHEN 'parsing' THEN '2' WHEN 'parsed' THEN '3' WHEN 'failed' THEN '4' ELSE parse_status END;
ALTER TABLE kb_documents MODIFY COLUMN source_type TINYINT UNSIGNED NOT NULL;
ALTER TABLE kb_documents MODIFY COLUMN parse_status TINYINT UNSIGNED NOT NULL;

UPDATE cnt_questions SET status = CASE status WHEN 'pending' THEN '1' WHEN 'approved' THEN '2' WHEN 'rejected' THEN '3' ELSE status END;
UPDATE cnt_questions SET intent = CASE intent WHEN 'education' THEN '1' WHEN 'research' THEN '2' WHEN 'comparison' THEN '3' WHEN 'purchase' THEN '4' ELSE COALESCE(intent, '2') END;
UPDATE cnt_questions SET funnel_stage = CASE funnel_stage WHEN 'awareness' THEN '1' WHEN 'consideration' THEN '2' WHEN 'decision' THEN '3' ELSE COALESCE(funnel_stage, '2') END;
ALTER TABLE cnt_questions MODIFY COLUMN status TINYINT UNSIGNED NOT NULL;
ALTER TABLE cnt_questions MODIFY COLUMN intent TINYINT UNSIGNED NOT NULL;
ALTER TABLE cnt_questions MODIFY COLUMN funnel_stage TINYINT UNSIGNED NOT NULL;

UPDATE pub_plans SET status = CASE status WHEN 'pending' THEN '1' WHEN 'active' THEN '2' WHEN 'paused' THEN '3' WHEN 'stopped' THEN '4' WHEN 'cancelled' THEN '5' ELSE status END;
UPDATE pub_plans SET schedule_type = CASE schedule_type WHEN 'immediate' THEN '1' WHEN 'scheduled' THEN '2' ELSE schedule_type END;
ALTER TABLE pub_plans MODIFY COLUMN status TINYINT UNSIGNED NOT NULL;
ALTER TABLE pub_plans MODIFY COLUMN schedule_type TINYINT UNSIGNED NOT NULL;

UPDATE geo_monitor_plans SET status = CASE status WHEN 'active' THEN '1' WHEN 'paused' THEN '2' WHEN 'stopped' THEN '3' ELSE status END;
UPDATE geo_monitor_plans SET schedule_type = CASE schedule_type WHEN 'once' THEN '1' WHEN 'manual' THEN '2' ELSE schedule_type END;
ALTER TABLE geo_monitor_plans MODIFY COLUMN status TINYINT UNSIGNED NOT NULL;
ALTER TABLE geo_monitor_plans MODIFY COLUMN schedule_type TINYINT UNSIGNED NOT NULL;

UPDATE sec_authorization_account_ids SET resource_type = CASE resource_type WHEN 'publish_channel' THEN '1' WHEN 'inclusion_site' THEN '2' ELSE resource_type END;
ALTER TABLE sec_authorization_account_ids MODIFY COLUMN resource_type TINYINT UNSIGNED NOT NULL;

UPDATE sec_self_media_authorizations SET authorization_status = CASE authorization_status WHEN 'pending' THEN '1' WHEN 'authorizing' THEN '2' WHEN 'active' THEN '3' WHEN 'expired' THEN '4' WHEN 'revoked' THEN '5' WHEN 'failed' THEN '6' WHEN 'error' THEN '6' ELSE authorization_status END;
UPDATE sec_self_media_authorizations SET usage_status = CASE usage_status WHEN 'enabled' THEN '1' WHEN 'paused' THEN '2' WHEN 'disabled' THEN '3' ELSE usage_status END;
ALTER TABLE sec_self_media_authorizations MODIFY COLUMN authorization_status TINYINT UNSIGNED NOT NULL;
ALTER TABLE sec_self_media_authorizations MODIFY COLUMN usage_status TINYINT UNSIGNED NOT NULL;

UPDATE sec_inclusion_site_authorizations SET authorization_status = CASE authorization_status WHEN 'pending' THEN '1' WHEN 'authorizing' THEN '2' WHEN 'active' THEN '3' WHEN 'expired' THEN '4' WHEN 'revoked' THEN '5' WHEN 'failed' THEN '6' WHEN 'error' THEN '6' ELSE authorization_status END;
UPDATE sec_inclusion_site_authorizations SET usage_status = CASE usage_status WHEN 'enabled' THEN '1' WHEN 'paused' THEN '2' WHEN 'disabled' THEN '3' ELSE usage_status END;
ALTER TABLE sec_inclusion_site_authorizations MODIFY COLUMN authorization_status TINYINT UNSIGNED NOT NULL;
ALTER TABLE sec_inclusion_site_authorizations MODIFY COLUMN usage_status TINYINT UNSIGNED NOT NULL;

UPDATE sec_authorization_sessions SET resource_type = CASE resource_type WHEN 'publish_channel' THEN '1' WHEN 'inclusion_site' THEN '2' ELSE resource_type END;
UPDATE sec_authorization_sessions SET status = CASE status WHEN 'pending' THEN '1' WHEN 'authorizing' THEN '2' WHEN 'completed' THEN '3' WHEN 'expired' THEN '4' WHEN 'failed' THEN '5' WHEN 'error' THEN '5' ELSE status END;
ALTER TABLE sec_authorization_sessions MODIFY COLUMN resource_type TINYINT UNSIGNED NOT NULL;
ALTER TABLE sec_authorization_sessions MODIFY COLUMN status TINYINT UNSIGNED NOT NULL;
