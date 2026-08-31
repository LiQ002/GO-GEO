DROP TABLE IF EXISTS cfg_article_type_version_channels;
DROP TABLE IF EXISTS cfg_article_type_models;
DROP TABLE IF EXISTS cfg_article_type_rules;
DROP TABLE IF EXISTS cfg_article_type_input_options;
DROP TABLE IF EXISTS cfg_article_type_input_fields;
DROP TABLE IF EXISTS cfg_article_type_sections;

UPDATE cnt_article_generation_tasks SET prompt_version_id = 0 WHERE prompt_version_id IS NULL;
ALTER TABLE cnt_article_generation_tasks
  MODIFY COLUMN prompt_version_id BIGINT UNSIGNED NOT NULL;

UPDATE cfg_article_type_versions SET prompt_version_id = 0 WHERE prompt_version_id IS NULL;
ALTER TABLE cfg_article_type_versions
  MODIFY COLUMN prompt_version_id BIGINT UNSIGNED NOT NULL,
  DROP COLUMN output_format,
  DROP COLUMN user_prompt_template,
  DROP COLUMN system_prompt;
