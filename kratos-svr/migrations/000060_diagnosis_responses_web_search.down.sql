ALTER TABLE sls_diagnosis_models
  DROP CONSTRAINT chk_sls_diag_model_search,
  DROP CONSTRAINT chk_sls_diag_model_api,
  DROP COLUMN diagnosis_web_search_enabled,
  DROP COLUMN diagnosis_api_mode;

ALTER TABLE cfg_writing_models
  DROP CONSTRAINT chk_cfg_writing_model_diag_search,
  DROP CONSTRAINT chk_cfg_writing_model_diag_api,
  DROP COLUMN diagnosis_web_search_enabled,
  DROP COLUMN diagnosis_api_mode;
