-- 回滚细软 GEO 产品版本种子数据
DELETE FROM ent_plan_features WHERE plan_id BETWEEN 1 AND 8;
DELETE FROM ent_plan_limits WHERE plan_id BETWEEN 1 AND 8;
DELETE FROM ent_plans WHERE id BETWEEN 1 AND 8;
