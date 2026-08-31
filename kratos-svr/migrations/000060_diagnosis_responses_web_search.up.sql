ALTER TABLE cfg_writing_models
  ADD COLUMN diagnosis_api_mode TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER citation_capability,
  ADD COLUMN diagnosis_web_search_enabled BOOLEAN NOT NULL DEFAULT FALSE AFTER diagnosis_api_mode,
  ADD CONSTRAINT chk_cfg_writing_model_diag_api CHECK (diagnosis_api_mode IN (1,2)),
  ADD CONSTRAINT chk_cfg_writing_model_diag_search CHECK (
    diagnosis_web_search_enabled = FALSE OR
    (diagnosis_api_mode = 2 AND citation_capability = 2)
  );

ALTER TABLE sls_diagnosis_models
  ADD COLUMN diagnosis_api_mode TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER citation_capability,
  ADD COLUMN diagnosis_web_search_enabled BOOLEAN NOT NULL DEFAULT FALSE AFTER diagnosis_api_mode,
  ADD CONSTRAINT chk_sls_diag_model_api CHECK (diagnosis_api_mode IN (1,2)),
  ADD CONSTRAINT chk_sls_diag_model_search CHECK (
    diagnosis_web_search_enabled = FALSE OR
    (diagnosis_api_mode = 2 AND citation_capability = 2)
  );

UPDATE cfg_writing_models m
JOIN cfg_writing_model_purposes p
  ON p.writing_model_id = m.id AND p.purpose = 6
SET m.diagnosis_api_mode = 2,
    m.diagnosis_web_search_enabled = TRUE,
    m.citation_capability = 2
WHERE (
    m.provider = 2 AND m.model_id LIKE 'deepseek-v4-%'
  ) OR (
    m.provider = 1 AND (
      m.model_id LIKE 'qwen3%'
      OR m.model_id LIKE 'qwen-plus%'
      OR m.model_id LIKE 'qwen-flash%'
    )
  );

UPDATE cfg_writing_models
SET base_url = 'https://api.deepseek.com'
WHERE provider = 2
  AND LOWER(TRIM(TRAILING '/' FROM base_url)) IN (
    'https://api.deepseek.com',
    'https://api.deepseek.com/v1'
  );
