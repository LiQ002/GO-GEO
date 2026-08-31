ALTER TABLE cnt_brands MODIFY COLUMN status VARCHAR(32) NOT NULL;
UPDATE cnt_brands SET status = CASE status WHEN '1' THEN 'active' WHEN '2' THEN 'archived' ELSE status END;

ALTER TABLE kb_bases MODIFY COLUMN status VARCHAR(32) NOT NULL;
UPDATE kb_bases SET status = CASE status WHEN '1' THEN 'active' WHEN '2' THEN 'archived' ELSE status END;

ALTER TABLE kb_documents MODIFY COLUMN source_type VARCHAR(32) NOT NULL;
ALTER TABLE kb_documents MODIFY COLUMN parse_status VARCHAR(32) NOT NULL;
UPDATE kb_documents SET source_type = CASE source_type WHEN '1' THEN 'text' WHEN '2' THEN 'url' WHEN '3' THEN 'file' ELSE source_type END;
UPDATE kb_documents SET parse_status = CASE parse_status WHEN '1' THEN 'pending' WHEN '2' THEN 'parsing' WHEN '3' THEN 'parsed' WHEN '4' THEN 'failed' ELSE parse_status END;

ALTER TABLE cnt_questions MODIFY COLUMN status VARCHAR(32) NOT NULL;
ALTER TABLE cnt_questions MODIFY COLUMN intent VARCHAR(64);
ALTER TABLE cnt_questions MODIFY COLUMN funnel_stage VARCHAR(64);
UPDATE cnt_questions SET status = CASE status WHEN '1' THEN 'pending' WHEN '2' THEN 'approved' WHEN '3' THEN 'rejected' ELSE status END;
UPDATE cnt_questions SET intent = CASE intent WHEN '1' THEN 'education' WHEN '2' THEN 'research' WHEN '3' THEN 'comparison' WHEN '4' THEN 'purchase' ELSE intent END;
UPDATE cnt_questions SET funnel_stage = CASE funnel_stage WHEN '1' THEN 'awareness' WHEN '2' THEN 'consideration' WHEN '3' THEN 'decision' ELSE funnel_stage END;

ALTER TABLE pub_plans MODIFY COLUMN status VARCHAR(32) NOT NULL;
ALTER TABLE pub_plans MODIFY COLUMN schedule_type VARCHAR(32) NOT NULL;
UPDATE pub_plans SET status = CASE status WHEN '1' THEN 'pending' WHEN '2' THEN 'active' WHEN '3' THEN 'paused' WHEN '4' THEN 'stopped' WHEN '5' THEN 'cancelled' ELSE status END;
UPDATE pub_plans SET schedule_type = CASE schedule_type WHEN '1' THEN 'immediate' WHEN '2' THEN 'scheduled' ELSE schedule_type END;

ALTER TABLE geo_monitor_plans MODIFY COLUMN status VARCHAR(32) NOT NULL;
ALTER TABLE geo_monitor_plans MODIFY COLUMN schedule_type VARCHAR(32) NOT NULL;
UPDATE geo_monitor_plans SET status = CASE status WHEN '1' THEN 'active' WHEN '2' THEN 'paused' WHEN '3' THEN 'stopped' ELSE status END;
UPDATE geo_monitor_plans SET schedule_type = CASE schedule_type WHEN '1' THEN 'once' WHEN '2' THEN 'manual' ELSE schedule_type END;

ALTER TABLE sec_authorization_account_ids MODIFY COLUMN resource_type VARCHAR(32) NOT NULL;
UPDATE sec_authorization_account_ids SET resource_type = CASE resource_type WHEN '1' THEN 'publish_channel' WHEN '2' THEN 'inclusion_site' ELSE resource_type END;

ALTER TABLE sec_self_media_authorizations MODIFY COLUMN authorization_status VARCHAR(32) NOT NULL;
ALTER TABLE sec_self_media_authorizations MODIFY COLUMN usage_status VARCHAR(32) NOT NULL;
UPDATE sec_self_media_authorizations SET authorization_status = CASE authorization_status WHEN '1' THEN 'pending' WHEN '2' THEN 'authorizing' WHEN '3' THEN 'active' WHEN '4' THEN 'expired' WHEN '5' THEN 'revoked' WHEN '6' THEN 'failed' ELSE authorization_status END;
UPDATE sec_self_media_authorizations SET usage_status = CASE usage_status WHEN '1' THEN 'enabled' WHEN '2' THEN 'paused' WHEN '3' THEN 'disabled' ELSE usage_status END;

ALTER TABLE sec_inclusion_site_authorizations MODIFY COLUMN authorization_status VARCHAR(32) NOT NULL;
ALTER TABLE sec_inclusion_site_authorizations MODIFY COLUMN usage_status VARCHAR(32) NOT NULL;
UPDATE sec_inclusion_site_authorizations SET authorization_status = CASE authorization_status WHEN '1' THEN 'pending' WHEN '2' THEN 'authorizing' WHEN '3' THEN 'active' WHEN '4' THEN 'expired' WHEN '5' THEN 'revoked' WHEN '6' THEN 'failed' ELSE authorization_status END;
UPDATE sec_inclusion_site_authorizations SET usage_status = CASE usage_status WHEN '1' THEN 'enabled' WHEN '2' THEN 'paused' WHEN '3' THEN 'disabled' ELSE usage_status END;

ALTER TABLE sec_authorization_sessions MODIFY COLUMN resource_type VARCHAR(32) NOT NULL;
ALTER TABLE sec_authorization_sessions MODIFY COLUMN status VARCHAR(32) NOT NULL;
UPDATE sec_authorization_sessions SET resource_type = CASE resource_type WHEN '1' THEN 'publish_channel' WHEN '2' THEN 'inclusion_site' ELSE resource_type END;
UPDATE sec_authorization_sessions SET status = CASE status WHEN '1' THEN 'pending' WHEN '2' THEN 'authorizing' WHEN '3' THEN 'completed' WHEN '4' THEN 'expired' WHEN '5' THEN 'failed' ELSE status END;
