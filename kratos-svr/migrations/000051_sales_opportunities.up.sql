CREATE TABLE IF NOT EXISTS sls_opportunities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  owner_admin_id BIGINT UNSIGNED NOT NULL,
  customer_name VARCHAR(128) NOT NULL,
  website VARCHAR(512),
  industry VARCHAR(128),
  region VARCHAR(128),
  contact_name VARCHAR(128),
  contact_phone VARCHAR(64),
  contact_email VARCHAR(255),
  brand_name VARCHAR(128) NOT NULL,
  target_audience TEXT,
  core_value TEXT,
  current_content TEXT,
  pain_points TEXT,
  expected_goals TEXT,
  budget_min_minor_units BIGINT NOT NULL DEFAULT 0,
  budget_max_minor_units BIGINT NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'CNY',
  status TINYINT UNSIGNED NOT NULL DEFAULT 1,
  remark TEXT,
  version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  closed_at DATETIME(6),
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  deleted_at DATETIME(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_sls_opportunities_code (code),
  KEY idx_sls_opportunities_owner_status_updated (owner_admin_id, status, updated_at),
  KEY idx_sls_opportunities_customer_name (customer_name),
  KEY idx_sls_opportunities_name (name),
  KEY idx_sls_opportunities_website (website(191)),
  KEY idx_sls_opportunities_industry (industry),
  KEY idx_sls_opportunities_region (region),
  KEY idx_sls_opportunities_contact_phone (contact_phone),
  KEY idx_sls_opportunities_contact_email (contact_email),
  KEY idx_sls_opportunities_brand_name (brand_name),
  KEY idx_sls_opportunities_status (status),
  KEY idx_sls_opportunities_closed_at (closed_at),
  KEY idx_sls_opportunities_deleted_at (deleted_at),
  CONSTRAINT fk_sls_opportunities_owner FOREIGN KEY (owner_admin_id) REFERENCES adm_users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_sls_opportunities_budget CHECK (
    budget_min_minor_units >= 0 AND
    budget_max_minor_units >= 0 AND
    (budget_max_minor_units = 0 OR budget_max_minor_units >= budget_min_minor_units)
  ),
  CONSTRAINT chk_sls_opportunities_status CHECK (status IN (1, 2, 3))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sls_opportunity_brand_aliases (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  opportunity_id BIGINT UNSIGNED NOT NULL,
  alias VARCHAR(128) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sls_opportunity_alias (opportunity_id, alias),
  KEY idx_sls_opportunity_alias_sort (opportunity_id, sort_order, id),
  CONSTRAINT fk_sls_opportunity_alias FOREIGN KEY (opportunity_id) REFERENCES sls_opportunities(id) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sls_opportunity_products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  opportunity_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  selling_points TEXT,
  target_audience TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_sls_opportunity_product_sort (opportunity_id, sort_order, id),
  CONSTRAINT fk_sls_opportunity_product FOREIGN KEY (opportunity_id) REFERENCES sls_opportunities(id) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sls_opportunity_competitors (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  opportunity_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(128) NOT NULL,
  website VARCHAR(512),
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_sls_opportunity_competitor_sort (opportunity_id, sort_order, id),
  CONSTRAINT fk_sls_opportunity_competitor FOREIGN KEY (opportunity_id) REFERENCES sls_opportunities(id) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
