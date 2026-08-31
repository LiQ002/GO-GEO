DELETE rp FROM adm_role_permissions rp
JOIN adm_roles r ON r.id = rp.role_id
JOIN adm_permissions p ON p.id = rp.permission_id
WHERE r.code IN ('super_admin','sales','sales_manager')
  AND p.code IN ('sales.opportunity.read','sales.opportunity.manage');

DELETE rb FROM adm_role_bindings rb
JOIN adm_roles r ON r.id = rb.role_id
WHERE r.code IN ('sales','sales_manager');

DELETE FROM adm_roles WHERE code IN ('sales','sales_manager');
DELETE FROM adm_permissions WHERE code IN ('sales.opportunity.read','sales.opportunity.manage');
