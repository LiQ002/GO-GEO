ALTER TABLE sls_diagnosis_result_analyses
  ADD COLUMN included BOOLEAN NOT NULL DEFAULT FALSE AFTER confidence,
  ADD COLUMN completeness_score DECIMAL(6,5) NOT NULL DEFAULT 0 AFTER included,
  ADD COLUMN answer_quality_score DECIMAL(6,5) NOT NULL DEFAULT 0 AFTER completeness_score,
  ADD COLUMN freshness_score DECIMAL(6,5) NOT NULL DEFAULT 0 AFTER answer_quality_score,
  ADD COLUMN freshness_available BOOLEAN NOT NULL DEFAULT FALSE AFTER freshness_score,
  ADD COLUMN recommendation_position INT NOT NULL DEFAULT 0 AFTER freshness_available,
  ADD COLUMN answer_summary TEXT NULL AFTER recommendation_position,
  ADD COLUMN strengths TEXT NULL AFTER answer_summary,
  ADD COLUMN gaps TEXT NULL AFTER strengths;

ALTER TABLE sls_diagnosis_citations
  ADD COLUMN source_type TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER ownership_type,
  ADD CONSTRAINT chk_sls_diag_citation_source_type CHECK (source_type IN (1,2,3,4,5,6,7,8,9));

ALTER TABLE sls_diagnosis_report_models
  ADD COLUMN inclusion_rate DECIMAL(12,6) NOT NULL DEFAULT 0 AFTER brand_mention_rate,
  ADD COLUMN completeness_score DECIMAL(12,6) NOT NULL DEFAULT 0 AFTER inclusion_rate,
  ADD COLUMN answer_quality_score DECIMAL(12,6) NOT NULL DEFAULT 0 AFTER completeness_score,
  ADD COLUMN average_recommendation_position DECIMAL(12,6) NOT NULL DEFAULT 0 AFTER answer_quality_score,
  ADD COLUMN recommendation_position_available BOOLEAN NOT NULL DEFAULT FALSE AFTER average_recommendation_position,
  ADD COLUMN timeliness_rate DECIMAL(12,6) NOT NULL DEFAULT 0 AFTER recommendation_position_available,
  ADD COLUMN timeliness_available BOOLEAN NOT NULL DEFAULT FALSE AFTER timeliness_rate,
  ADD COLUMN overall_rating VARCHAR(16) NOT NULL DEFAULT '待评估' AFTER timeliness_available,
  ADD COLUMN strengths TEXT NULL AFTER overall_rating,
  ADD COLUMN gaps TEXT NULL AFTER strengths,
  ADD COLUMN diagnosis_conclusion TEXT NULL AFTER gaps;

ALTER TABLE sls_diagnosis_report_entities
  ADD COLUMN competitor_level TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER entity_name,
  ADD COLUMN threat_level TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER competitor_level,
  ADD COLUMN location VARCHAR(128) NULL AFTER threat_level,
  ADD COLUMN recommendation_reason TEXT NULL AFTER location,
  ADD CONSTRAINT chk_sls_diag_report_entity_competitor_level CHECK (competitor_level IN (0,1,2)),
  ADD CONSTRAINT chk_sls_diag_report_entity_threat_level CHECK (threat_level IN (0,1,2,3,4));

ALTER TABLE sls_diagnosis_report_sources
  ADD COLUMN source_type TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER ownership_type,
  ADD CONSTRAINT chk_sls_diag_report_source_type CHECK (source_type IN (1,2,3,4,5,6,7,8,9));

ALTER TABLE sls_diagnosis_report_findings
  ADD COLUMN section_code VARCHAR(32) NOT NULL DEFAULT 'summary' AFTER severity,
  ADD COLUMN priority TINYINT UNSIGNED NOT NULL DEFAULT 3 AFTER section_code,
  ADD COLUMN impact_level TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER priority,
  ADD COLUMN urgency_level TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER impact_level,
  ADD CONSTRAINT chk_sls_diag_report_finding_priority CHECK (priority IN (0,1,2,3)),
  ADD CONSTRAINT chk_sls_diag_report_finding_impact CHECK (impact_level IN (1,2,3)),
  ADD CONSTRAINT chk_sls_diag_report_finding_urgency CHECK (urgency_level IN (1,2,3));
