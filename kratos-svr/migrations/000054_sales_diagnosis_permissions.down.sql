DELETE rp FROM adm_role_permissions rp
JOIN adm_permissions p ON p.id = rp.permission_id
WHERE p.code IN ('sales.diagnosis.read','sales.diagnosis.manage');

DELETE FROM adm_permissions WHERE code IN ('sales.diagnosis.read','sales.diagnosis.manage');
