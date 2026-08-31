CREATE TABLE IF NOT EXISTS kb_bases (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enterprise_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(128) NOT NULL,
  description VARCHAR(1024),
  status VARCHAR(32) NOT NULL,
  version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  deleted_at DATETIME(6),
  PRIMARY KEY (id),
  KEY idx_kb_base_tenant_status (enterprise_id, status, created_at),
  KEY idx_kb_base_tenant_name (enterprise_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kb_documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enterprise_id BIGINT UNSIGNED NOT NULL,
  knowledge_base_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  source_type VARCHAR(32) NOT NULL,
  source_url VARCHAR(2048),
  object_key VARCHAR(1024),
  content_hash CHAR(64),
  mime_type VARCHAR(128),
  parse_status VARCHAR(32) NOT NULL,
  parse_error TEXT,
  document_version INT UNSIGNED NOT NULL DEFAULT 1,
  metadata_json JSON,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  deleted_at DATETIME(6),
  PRIMARY KEY (id),
  KEY idx_kb_document_tenant_base (enterprise_id, knowledge_base_id, created_at),
  KEY idx_kb_document_tenant_parse (enterprise_id, parse_status, updated_at),
  KEY idx_kb_document_hash (enterprise_id, content_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kb_chunks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enterprise_id BIGINT UNSIGNED NOT NULL,
  knowledge_document_id BIGINT UNSIGNED NOT NULL,
  document_version INT UNSIGNED NOT NULL,
  chunk_index INT UNSIGNED NOT NULL,
  content LONGTEXT NOT NULL,
  content_hash CHAR(64) NOT NULL,
  locator_json JSON,
  metadata_json JSON,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_kb_chunk_version_index (knowledge_document_id, document_version, chunk_index),
  KEY idx_kb_chunk_tenant_document (enterprise_id, knowledge_document_id, document_version),
  KEY idx_kb_chunk_hash (enterprise_id, content_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
