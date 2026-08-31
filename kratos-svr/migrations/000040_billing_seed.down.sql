DELETE FROM cfg_system_settings
WHERE namespace = 'billing' AND key_name IN ('unit_costs', 'action_registry');
