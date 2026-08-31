ALTER TABLE cfg_writing_models
  ADD COLUMN citation_capability TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER timeout_seconds,
  ADD CONSTRAINT chk_cfg_writing_model_citation_capability CHECK (citation_capability IN (1,2));

ALTER TABLE sls_diagnosis_models
  ADD COLUMN citation_capability TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER timeout_seconds,
  ADD CONSTRAINT chk_sls_diag_model_citation_capability CHECK (citation_capability IN (1,2));

CREATE TABLE IF NOT EXISTS sls_diagnosis_profile_claims (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  diagnosis_id BIGINT UNSIGNED NOT NULL,
  claim_type TINYINT UNSIGNED NOT NULL,
  source_field VARCHAR(64) NOT NULL,
  source_item_id BIGINT UNSIGNED NULL,
  claim_text TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_sls_diag_claim_sort (diagnosis_id, sort_order, id),
  CONSTRAINT fk_sls_diag_claim_diagnosis FOREIGN KEY (diagnosis_id) REFERENCES sls_diagnoses(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT chk_sls_diag_claim_type CHECK (claim_type IN (1,2,3,4,5))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sls_diagnosis_result_analyses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  result_id BIGINT UNSIGNED NOT NULL,
  analysis_version INT UNSIGNED NOT NULL,
  rule_version VARCHAR(64) NOT NULL,
  analyzer_kind TINYINT UNSIGNED NOT NULL,
  analyzer_model_name VARCHAR(128) NULL,
  prompt_snapshot LONGTEXT NULL,
  raw_response_json JSON NULL,
  status TINYINT UNSIGNED NOT NULL,
  dominant_sentiment TINYINT UNSIGNED NOT NULL DEFAULT 1,
  confidence DECIMAL(6,5) NOT NULL DEFAULT 0,
  error_message VARCHAR(1024) NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sls_diag_analysis_version (result_id, analysis_version),
  KEY idx_sls_diag_analysis_status (status, created_at),
  CONSTRAINT fk_sls_diag_analysis_result FOREIGN KEY (result_id) REFERENCES sls_diagnosis_results(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT chk_sls_diag_analysis_kind CHECK (analyzer_kind IN (1,2,3)),
  CONSTRAINT chk_sls_diag_analysis_status CHECK (status IN (1,2,3)),
  CONSTRAINT chk_sls_diag_analysis_sentiment CHECK (dominant_sentiment IN (1,2,3,4))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sls_diagnosis_entity_mentions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  analysis_id BIGINT UNSIGNED NOT NULL,
  entity_type TINYINT UNSIGNED NOT NULL,
  entity_ref_id BIGINT UNSIGNED NULL,
  entity_name VARCHAR(128) NOT NULL,
  mention_count INT UNSIGNED NOT NULL DEFAULT 0,
  first_position INT NOT NULL DEFAULT 0,
  rank_position INT NOT NULL DEFAULT 0,
  sentiment TINYINT UNSIGNED NOT NULL DEFAULT 1,
  confidence DECIMAL(6,5) NOT NULL DEFAULT 0,
  evidence_excerpt TEXT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sls_diag_entity_analysis_name (analysis_id, entity_type, entity_name),
  KEY idx_sls_diag_entity_name (entity_name),
  CONSTRAINT fk_sls_diag_entity_analysis FOREIGN KEY (analysis_id) REFERENCES sls_diagnosis_result_analyses(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT chk_sls_diag_entity_type CHECK (entity_type IN (1,2,3)),
  CONSTRAINT chk_sls_diag_entity_sentiment CHECK (sentiment IN (1,2,3,4)),
  CONSTRAINT chk_sls_diag_entity_rank CHECK (rank_position >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sls_diagnosis_claim_matches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  analysis_id BIGINT UNSIGNED NOT NULL,
  claim_id BIGINT UNSIGNED NOT NULL,
  matched BOOLEAN NOT NULL DEFAULT FALSE,
  confidence DECIMAL(6,5) NOT NULL DEFAULT 0,
  evidence_excerpt TEXT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sls_diag_claim_match (analysis_id, claim_id),
  KEY idx_sls_diag_claim_match_claim (claim_id),
  CONSTRAINT fk_sls_diag_claim_match_analysis FOREIGN KEY (analysis_id) REFERENCES sls_diagnosis_result_analyses(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_sls_diag_claim_match_claim FOREIGN KEY (claim_id) REFERENCES sls_diagnosis_profile_claims(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE sls_diagnosis_citations
  ADD COLUMN provider_source_id VARCHAR(255) NULL AFTER result_id,
  ADD COLUMN source_name VARCHAR(255) NULL AFTER provider_source_id,
  ADD COLUMN snippet TEXT NULL AFTER domain,
  ADD COLUMN position INT NOT NULL DEFAULT 0 AFTER snippet,
  ADD COLUMN ownership_type TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER position,
  ADD COLUMN verification_status TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER ownership_type,
  ADD COLUMN captured_at DATETIME(6) NULL AFTER verification_status,
  ADD CONSTRAINT chk_sls_diag_citation_ownership CHECK (ownership_type IN (1,2,3)),
  ADD CONSTRAINT chk_sls_diag_citation_verification CHECK (verification_status IN (1,2));

ALTER TABLE sls_diagnosis_metrics
  ADD COLUMN availability_status TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER sample_count,
  ADD COLUMN rule_version VARCHAR(64) NOT NULL DEFAULT 'geo-report-v1' AFTER availability_status,
  ADD CONSTRAINT chk_sls_diag_metric_availability CHECK (availability_status IN (1,2,3));

CREATE TABLE IF NOT EXISTS sls_diagnosis_metric_samples (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  metric_id BIGINT UNSIGNED NOT NULL,
  result_id BIGINT UNSIGNED NOT NULL,
  numerator_value DECIMAL(12,6) NOT NULL DEFAULT 0,
  denominator_value DECIMAL(12,6) NOT NULL DEFAULT 0,
  eligible BOOLEAN NOT NULL DEFAULT FALSE,
  reason VARCHAR(255) NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sls_diag_metric_sample (metric_id, result_id),
  KEY idx_sls_diag_metric_sample_result (result_id),
  CONSTRAINT fk_sls_diag_metric_sample_metric FOREIGN KEY (metric_id) REFERENCES sls_diagnosis_metrics(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_sls_diag_metric_sample_result FOREIGN KEY (result_id) REFERENCES sls_diagnosis_results(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE sls_diagnosis_reports
  DROP INDEX uk_sls_diag_report_diagnosis,
  ADD COLUMN is_current BOOLEAN NOT NULL DEFAULT TRUE AFTER version,
  ADD UNIQUE KEY uk_sls_diag_report_version (diagnosis_id, version),
  ADD KEY idx_sls_diag_report_current (diagnosis_id, is_current, generated_at);

ALTER TABLE sls_diagnosis_report_models
  ADD COLUMN mention_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER brand_share_of_voice,
  ADD COLUMN top3_rate DECIMAL(12,6) NOT NULL DEFAULT 0 AFTER mention_count,
  ADD COLUMN top3_available BOOLEAN NOT NULL DEFAULT FALSE AFTER top3_rate,
  ADD COLUMN content_adoption_rate DECIMAL(12,6) NOT NULL DEFAULT 0 AFTER top3_available,
  ADD COLUMN content_adoption_available BOOLEAN NOT NULL DEFAULT FALSE AFTER content_adoption_rate,
  ADD COLUMN citation_available BOOLEAN NOT NULL DEFAULT FALSE AFTER content_adoption_available,
  ADD COLUMN positive_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER citation_available,
  ADD COLUMN neutral_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER positive_count,
  ADD COLUMN negative_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER neutral_count,
  ADD COLUMN unknown_sentiment_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER negative_count;

CREATE TABLE IF NOT EXISTS sls_diagnosis_finding_evidences (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  finding_id BIGINT UNSIGNED NOT NULL,
  metric_id BIGINT UNSIGNED NULL,
  result_id BIGINT UNSIGNED NULL,
  citation_id BIGINT UNSIGNED NULL,
  evidence_type TINYINT UNSIGNED NOT NULL,
  note VARCHAR(255) NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_sls_diag_finding_evidence_finding (finding_id, id),
  KEY idx_sls_diag_finding_evidence_metric (metric_id),
  KEY idx_sls_diag_finding_evidence_result (result_id),
  KEY idx_sls_diag_finding_evidence_citation (citation_id),
  CONSTRAINT fk_sls_diag_finding_evidence_finding FOREIGN KEY (finding_id) REFERENCES sls_diagnosis_report_findings(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_sls_diag_finding_evidence_metric FOREIGN KEY (metric_id) REFERENCES sls_diagnosis_metrics(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_sls_diag_finding_evidence_result FOREIGN KEY (result_id) REFERENCES sls_diagnosis_results(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_sls_diag_finding_evidence_citation FOREIGN KEY (citation_id) REFERENCES sls_diagnosis_citations(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_sls_diag_finding_evidence_type CHECK (evidence_type IN (1,2,3))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sls_diagnosis_report_entities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  report_id BIGINT UNSIGNED NOT NULL,
  diagnosis_model_id BIGINT UNSIGNED NULL,
  entity_type TINYINT UNSIGNED NOT NULL,
  entity_name VARCHAR(128) NOT NULL,
  mention_count INT UNSIGNED NOT NULL DEFAULT 0,
  mention_rate DECIMAL(12,6) NOT NULL DEFAULT 0,
  average_rank DECIMAL(12,6) NOT NULL DEFAULT 0,
  top3_count INT UNSIGNED NOT NULL DEFAULT 0,
  positive_count INT UNSIGNED NOT NULL DEFAULT 0,
  neutral_count INT UNSIGNED NOT NULL DEFAULT 0,
  negative_count INT UNSIGNED NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sls_diag_report_entity (report_id, diagnosis_model_id, entity_type, entity_name),
  KEY idx_sls_diag_report_entity_sort (report_id, sort_order, id),
  CONSTRAINT fk_sls_diag_report_entity_report FOREIGN KEY (report_id) REFERENCES sls_diagnosis_reports(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_sls_diag_report_entity_model FOREIGN KEY (diagnosis_model_id) REFERENCES sls_diagnosis_models(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sls_diagnosis_report_sources (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  report_id BIGINT UNSIGNED NOT NULL,
  diagnosis_model_id BIGINT UNSIGNED NULL,
  domain VARCHAR(255) NOT NULL,
  source_name VARCHAR(255) NULL,
  ownership_type TINYINT UNSIGNED NOT NULL DEFAULT 1,
  citation_count INT UNSIGNED NOT NULL DEFAULT 0,
  share_rate DECIMAL(12,6) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sls_diag_report_source (report_id, diagnosis_model_id, domain),
  KEY idx_sls_diag_report_source_sort (report_id, sort_order, id),
  CONSTRAINT fk_sls_diag_report_source_report FOREIGN KEY (report_id) REFERENCES sls_diagnosis_reports(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_sls_diag_report_source_model FOREIGN KEY (diagnosis_model_id) REFERENCES sls_diagnosis_models(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_sls_diag_report_source_ownership CHECK (ownership_type IN (1,2,3))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sls_diagnosis_report_entity_evidences (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  report_entity_id BIGINT UNSIGNED NOT NULL,
  entity_mention_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sls_diag_report_entity_evidence (report_entity_id, entity_mention_id),
  KEY idx_sls_diag_report_entity_evidence_mention (entity_mention_id),
  CONSTRAINT fk_sls_diag_report_entity_evidence_report FOREIGN KEY (report_entity_id) REFERENCES sls_diagnosis_report_entities(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_sls_diag_report_entity_evidence_mention FOREIGN KEY (entity_mention_id) REFERENCES sls_diagnosis_entity_mentions(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sls_diagnosis_report_source_citations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  report_source_id BIGINT UNSIGNED NOT NULL,
  citation_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sls_diag_report_source_citation (report_source_id, citation_id),
  KEY idx_sls_diag_report_source_citation_source (citation_id),
  CONSTRAINT fk_sls_diag_report_source_citation_report FOREIGN KEY (report_source_id) REFERENCES sls_diagnosis_report_sources(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_sls_diag_report_source_citation_source FOREIGN KEY (citation_id) REFERENCES sls_diagnosis_citations(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
