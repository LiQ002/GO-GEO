-- 注意：由于删除的数据无法恢复，此回滚脚本仅作为占位
-- 如需回滚，请重新运行 000042_seed_geo_plans.up.sql 恢复套餐配置
-- 企业配额数据无法自动恢复，需联系运维从备份恢复
SELECT 'Rollback for 000043 is a no-op; seed data will be restored by re-running 000042' AS message;
