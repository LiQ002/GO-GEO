ALTER TABLE cfg_inclusion_sites
  DROP COLUMN capabilities_json,
  DROP COLUMN model_entries_json,
  DROP COLUMN evidence_rules_json,
  DROP COLUMN limits_json,
  DROP COLUMN availability_json,
  DROP COLUMN visibility_json;
