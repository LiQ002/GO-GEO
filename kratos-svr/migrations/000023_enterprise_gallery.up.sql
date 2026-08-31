CREATE TABLE IF NOT EXISTS cnt_gallery_albums (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enterprise_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(128) NOT NULL,
  category TINYINT UNSIGNED NOT NULL,
  description VARCHAR(1024),
  version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  deleted_at DATETIME(6),
  PRIMARY KEY (id),
  KEY idx_gallery_album_tenant_category (enterprise_id, category, updated_at),
  KEY idx_gallery_album_tenant_name (enterprise_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cnt_gallery_images (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enterprise_id BIGINT UNSIGNED NOT NULL,
  album_id BIGINT UNSIGNED NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  object_key VARCHAR(512) COLLATE utf8mb4_bin NOT NULL,
  mime_type VARCHAR(128) NOT NULL,
  size_bytes BIGINT NOT NULL,
  content_hash CHAR(64) NOT NULL,
  version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  deleted_at DATETIME(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_gallery_image_object_key (object_key),
  KEY idx_gallery_image_tenant_album (enterprise_id, album_id, created_at),
  KEY idx_gallery_image_tenant_hash (enterprise_id, content_hash),
  CONSTRAINT fk_gallery_image_album
    FOREIGN KEY (album_id) REFERENCES cnt_gallery_albums (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
