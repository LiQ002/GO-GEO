INSERT IGNORE INTO adm_permissions (code,name,resource,action,description,created_at,updated_at) VALUES
('sales.opportunity.read','查看销售机会','sales_opportunity','read','查看权限范围内的销售机会和客户诊断资料',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6)),
('sales.opportunity.manage','管理销售机会','sales_opportunity','manage','创建、编辑、分配和变更销售机会状态',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));

INSERT IGNORE INTO adm_roles (code,name,description,data_scope,status,created_at,updated_at) VALUES
('sales','销售人员','维护本人负责的销售机会和客户资料',2,1,CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6)),
('sales_manager','销售负责人','查看和管理全部销售机会及客户资料',1,1,CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));

INSERT IGNORE INTO adm_role_permissions (role_id,permission_id,created_at,updated_at)
SELECT r.id,p.id,CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6)
FROM adm_roles r
JOIN adm_permissions p ON p.code IN ('sales.opportunity.read','sales.opportunity.manage')
WHERE r.code IN ('super_admin','sales','sales_manager');
