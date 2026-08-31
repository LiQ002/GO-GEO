ALTER TABLE cfg_inclusion_sites
  ADD COLUMN capabilities_json JSON NULL AFTER authorization_type,
  ADD COLUMN model_entries_json JSON NULL AFTER capabilities_json,
  ADD COLUMN evidence_rules_json JSON NULL AFTER model_entries_json,
  ADD COLUMN limits_json JSON NULL AFTER evidence_rules_json,
  ADD COLUMN availability_json JSON NULL AFTER limits_json,
  ADD COLUMN visibility_json JSON NULL AFTER availability_json;

UPDATE cfg_inclusion_sites
SET capabilities_json = JSON_OBJECT(), evidence_rules_json = JSON_OBJECT()
WHERE capabilities_json IS NULL OR evidence_rules_json IS NULL;

ALTER TABLE cfg_inclusion_sites
  MODIFY COLUMN capabilities_json JSON NOT NULL,
  MODIFY COLUMN evidence_rules_json JSON NOT NULL;
