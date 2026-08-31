-- Rollback: restore used_value to 0 (manual reset)
UPDATE ent_quota_limits
SET used_value = 0, reserved_value = 0
WHERE metric = 'publish_tasks';
