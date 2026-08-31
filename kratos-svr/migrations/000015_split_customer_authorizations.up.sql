CREATE TABLE IF NOT EXISTS sec_authorization_account_ids (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  resource_type VARCHAR(32) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_sec_authorization_account_type (resource_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sec_self_media_authorizations (
  id BIGINT UNSIGNED NOT NULL,
  enterprise_id BIGINT UNSIGNED NOT NULL,
  publish_channel_id BIGINT UNSIGNED NOT NULL,
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
  KEY idx_sec_self_media_tenant_channel (enterprise_id, publish_channel_id),
  KEY idx_sec_self_media_status (authorization_status, expires_at),
  KEY idx_sec_self_media_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sec_inclusion_site_authorizations (
  id BIGINT UNSIGNED NOT NULL,
  enterprise_id BIGINT UNSIGNED NOT NULL,
  inclusion_site_id BIGINT UNSIGNED NOT NULL,
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
  KEY idx_sec_inclusion_tenant_site (enterprise_id, inclusion_site_id),
  KEY idx_sec_inclusion_status (authorization_status, expires_at),
  KEY idx_sec_inclusion_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO sec_authorization_account_ids (id, resource_type, created_at)
SELECT id, resource_type, created_at
FROM sec_platform_accounts
WHERE resource_type IN ('publish_channel', 'inclusion_site');

INSERT IGNORE INTO sec_self_media_authorizations (
  id, enterprise_id, publish_channel_id, account_name, external_id, masked_identity,
  authorization_status, usage_status, expires_at, last_verified_at, last_used_at,
  daily_limit, is_default, metadata_json, version, created_at, updated_at, deleted_at
)
SELECT
  id, enterprise_id, resource_id, account_name, external_id, masked_identity,
  authorization_status, usage_status, expires_at, last_verified_at, last_used_at,
  daily_limit, is_default, metadata_json, version, created_at, updated_at, deleted_at
FROM sec_platform_accounts
WHERE resource_type = 'publish_channel';

INSERT IGNORE INTO sec_inclusion_site_authorizations (
  id, enterprise_id, inclusion_site_id, account_name, external_id, masked_identity,
  authorization_status, usage_status, expires_at, last_verified_at, last_used_at,
  daily_limit, is_default, metadata_json, version, created_at, updated_at, deleted_at
)
SELECT
  id, enterprise_id, resource_id, account_name, external_id, masked_identity,
  authorization_status, usage_status, expires_at, last_verified_at, last_used_at,
  daily_limit, is_default, metadata_json, version, created_at, updated_at, deleted_at
FROM sec_platform_accounts
WHERE resource_type = 'inclusion_site';
