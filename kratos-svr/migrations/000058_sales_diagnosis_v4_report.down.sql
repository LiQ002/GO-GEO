ALTER TABLE sls_diagnosis_report_findings
  DROP CONSTRAINT chk_sls_diag_report_finding_urgency,
  DROP CONSTRAINT chk_sls_diag_report_finding_impact,
  DROP CONSTRAINT chk_sls_diag_report_finding_priority,
  DROP COLUMN urgency_level,
  DROP COLUMN impact_level,
  DROP COLUMN priority,
  DROP COLUMN section_code;

ALTER TABLE sls_diagnosis_report_sources
  DROP CONSTRAINT chk_sls_diag_report_source_type,
  DROP COLUMN source_type;

ALTER TABLE sls_diagnosis_report_entities
  DROP CONSTRAINT chk_sls_diag_report_entity_threat_level,
  DROP CONSTRAINT chk_sls_diag_report_entity_competitor_level,
  DROP COLUMN recommendation_reason,
  DROP COLUMN location,
  DROP COLUMN threat_level,
  DROP COLUMN competitor_level;

ALTER TABLE sls_diagnosis_report_models
  DROP COLUMN diagnosis_conclusion,
  DROP COLUMN gaps,
  DROP COLUMN strengths,
  DROP COLUMN overall_rating,
  DROP COLUMN timeliness_available,
  DROP COLUMN timeliness_rate,
  DROP COLUMN recommendation_position_available,
  DROP COLUMN average_recommendation_position,
  DROP COLUMN answer_quality_score,
  DROP COLUMN completeness_score,
  DROP COLUMN inclusion_rate;

ALTER TABLE sls_diagnosis_citations
  DROP CONSTRAINT chk_sls_diag_citation_source_type,
  DROP COLUMN source_type;

ALTER TABLE sls_diagnosis_result_analyses
  DROP COLUMN gaps,
  DROP COLUMN strengths,
  DROP COLUMN answer_summary,
  DROP COLUMN recommendation_position,
  DROP COLUMN freshness_available,
  DROP COLUMN freshness_score,
  DROP COLUMN answer_quality_score,
  DROP COLUMN completeness_score,
  DROP COLUMN included;
