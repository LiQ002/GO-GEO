-- 清理套餐配置中的死指标
-- 删除已废弃的指标配置：5=AI Token数, 8=产品核心词数, 10=AI衍生长尾词数

-- 从套餐配额限制中删除死指标
DELETE FROM ent_plan_limits WHERE metric IN (5, 8, 10);

-- 从企业实际配额中删除死指标（如果存在）
DELETE FROM ent_quota_limits WHERE metric IN ('ai_tokens', 'product_keywords', 'ai_derived_keywords');
