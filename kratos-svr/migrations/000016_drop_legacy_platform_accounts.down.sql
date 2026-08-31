CREATE TABLE IF NOT EXISTS sec_platform_accounts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enterprise_id BIGINT UNSIGNED NOT NULL,
  resource_type VARCHAR(32) NOT NULL,
  resource_id BIGINT UNSIGNED NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  external_id VARCHAR(255),
  masked_identity VARCHAR(255),
  authorization_status VARCHAR(32) NOT NULL,
  usage_status VARCHAR(32) NOT NULL,
  expires_at DATETIME(6),
  last_verified_at DATETIME(6),
  last_used_at DATETIME(6),
  daily_limit BIGINT NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  metadata_json JSON,
  version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  deleted_at DATETIME(6),
  PRIMARY KEY (id),
  KEY idx_sec_account_tenant_resource (enterprise_id, resource_type, resource_id),
  KEY idx_sec_account_status (authorization_status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO sec_platform_accounts (
  id, enterprise_id, resource_type, resource_id, account_name, external_id,
  masked_identity, authorization_status, usage_status, expires_at,
  last_verified_at, last_used_at, daily_limit, is_default, metadata_json,
  version, created_at, updated_at, deleted_at
)
SELECT
  id, enterprise_id, 'publish_channel', publish_channel_id, account_name, external_id,
  masked_identity, authorization_status, usage_status, expires_at,
  last_verified_at, last_used_at, daily_limit, is_default, metadata_json,
  version, created_at, updated_at, deleted_at
FROM sec_self_media_authorizations
UNION ALL
SELECT
  id, enterprise_id, 'inclusion_site', inclusion_site_id, account_name, external_id,
  masked_identity, authorization_status, usage_status, expires_at,
  last_verified_at, last_used_at, daily_limit, is_default, metadata_json,
  version, created_at, updated_at, deleted_at
FROM sec_inclusion_site_authorizations;
