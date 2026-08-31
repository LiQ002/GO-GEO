INSERT IGNORE INTO adm_permissions (code,name,resource,action,description,created_at,updated_at) VALUES
('dashboard.read','查看运营总览','dashboard','read','查看平台指标、趋势和告警摘要',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6)),
('enterprise.manage','管理企业与套餐','enterprise','manage','管理企业账号、订阅、套餐与额度',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6)),
('article.manage','管理平台文章','article','manage','跨企业查看、审核和归档文章',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6)),
('publish_task.manage','管理发布任务','publish_task','manage','查看、重试、取消发布任务和登记回执',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6)),
('geo_task.manage','管理GEO任务','geo_task','manage','查看、重试、取消GEO任务和人工复核',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6)),
('worker.manage','管理工作节点','worker','manage','审批、停用和吊销工作节点',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6)),
('alert.manage','处理运行告警','alert','manage','查看和解决平台运行告警',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6)),
('content_config.manage','管理内容配置','content_config','manage','管理文章类型、提示词和编写模型',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6)),
('distribution_config.manage','管理投放监测配置','distribution_config','manage','管理发布渠道、投稿目标和检查站点',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6)),
('system.settings.manage','管理系统配置','system_settings','manage','管理平台级非凭据配置',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6)),
('system.audit.read','查看审计日志','audit_log','read','检索不可变平台审计记录',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6)),
('system.rbac.manage','管理平台账号权限','rbac','manage','管理平台账号、角色和权限绑定',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));

INSERT IGNORE INTO adm_role_permissions (role_id,permission_id,created_at,updated_at)
SELECT r.id,p.id,CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6)
FROM adm_roles r JOIN adm_permissions p
WHERE r.code='super_admin';
