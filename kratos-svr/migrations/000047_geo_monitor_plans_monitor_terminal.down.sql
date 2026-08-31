-- Remove monitor_terminal from geo_monitor_plans
ALTER TABLE geo_monitor_plans
  DROP COLUMN monitor_terminal;
