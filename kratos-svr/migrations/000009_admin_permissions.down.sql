DELETE rp FROM adm_role_permissions rp
JOIN adm_permissions p ON p.id=rp.permission_id
WHERE p.code IN ('dashboard.read','enterprise.manage','article.manage','publish_task.manage','geo_task.manage','worker.manage','alert.manage','content_config.manage','distribution_config.manage','system.settings.manage','system.audit.read','system.rbac.manage');
DELETE FROM adm_permissions WHERE code IN ('dashboard.read','enterprise.manage','article.manage','publish_task.manage','geo_task.manage','worker.manage','alert.manage','content_config.manage','distribution_config.manage','system.settings.manage','system.audit.read','system.rbac.manage');
