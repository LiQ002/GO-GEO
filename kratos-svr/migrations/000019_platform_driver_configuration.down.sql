ALTER TABLE cfg_inclusion_sites
  DROP COLUMN driver_type;

ALTER TABLE cfg_publish_channels
  DROP COLUMN login_url,
  DROP COLUMN driver_type;
