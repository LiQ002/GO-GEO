ALTER TABLE cfg_publish_channels
  ADD COLUMN capabilities_json JSON NULL AFTER execution_mode,
  ADD COLUMN rules_json JSON NULL AFTER capabilities_json,
  ADD COLUMN visibility_json JSON NULL AFTER rules_json;

UPDATE cfg_publish_channels SET capabilities_json = JSON_OBJECT() WHERE capabilities_json IS NULL;

ALTER TABLE cfg_publish_channels
  MODIFY COLUMN capabilities_json JSON NOT NULL;
