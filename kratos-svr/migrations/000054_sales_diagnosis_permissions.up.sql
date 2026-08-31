INSERT IGNORE INTO adm_permissions (code,name,resource,action,description,created_at,updated_at) VALUES
('sales.diagnosis.read','查看售前诊断','sales_diagnosis','read','查看权限范围内的诊断历史、模型回答、引用和指标',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6)),
('sales.diagnosis.manage','管理售前诊断','sales_diagnosis','manage','创建、执行、取消和重试权限范围内的售前诊断',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));

INSERT IGNORE INTO adm_role_permissions (role_id,permission_id,created_at,updated_at)
SELECT r.id,p.id,CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6)
FROM adm_roles r
JOIN adm_permissions p ON p.code IN ('sales.diagnosis.read','sales.diagnosis.manage')
WHERE r.code IN ('super_admin','sales','sales_manager');
