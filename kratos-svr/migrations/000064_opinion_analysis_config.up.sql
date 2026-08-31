-- 000064: 舆情分析独立配置。
-- 1. 写作模型新增 purpose=10（舆情总结），与 purpose=4（内容摘要，文章创作流程用）分离；
-- 2. 套餐功能新增 feature=8（舆情分析），控制周期性 LLM 舆情报告的生成权限。

-- 现有 purpose=4 的模型顺带挂上 purpose=10，保证功能开箱可用（管理员可后续调整）。
INSERT IGNORE INTO cfg_writing_model_purposes (writing_model_id, purpose, created_at, updated_at)
SELECT wm.id, 10, NOW(6), NOW(6)
FROM cfg_writing_models wm
JOIN cfg_writing_model_purposes p ON p.writing_model_id = wm.id AND p.purpose = 4
WHERE wm.deleted_at IS NULL;
