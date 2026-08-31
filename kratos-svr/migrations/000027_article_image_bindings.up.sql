CREATE TABLE IF NOT EXISTS cnt_article_images (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enterprise_id BIGINT UNSIGNED NOT NULL,
  article_id BIGINT UNSIGNED NOT NULL,
  gallery_image_id BIGINT UNSIGNED NOT NULL,
  placement TINYINT UNSIGNED NOT NULL DEFAULT 2,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  deleted_at DATETIME(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_article_gallery_image (article_id, gallery_image_id),
  KEY idx_article_image_tenant_article (enterprise_id, article_id, placement, sort_order),
  KEY idx_article_image_gallery (gallery_image_id),
  CONSTRAINT fk_article_image_article
    FOREIGN KEY (article_id) REFERENCES cnt_articles (id) ON DELETE CASCADE,
  CONSTRAINT fk_article_image_gallery
    FOREIGN KEY (gallery_image_id) REFERENCES cnt_gallery_images (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
