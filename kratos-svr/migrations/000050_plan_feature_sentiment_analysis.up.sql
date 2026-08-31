-- 新增套餐功能：情感分析（feature=6）
-- 用于在 worker 执行收录后按套餐决定是否调用 LLM 做情感判定，
-- 避免低版本企业（入门版/基础版）白白消耗 LLM 配额。
--
-- 套餐设计：
--   1=入门版     关闭（enabled=0）
--   2=基础版     关闭（enabled=0）
--   3=升级版     开启（enabled=1）
--   4=旅游版     开启（enabled=1）
--   5=ToC餐饮版  开启（enabled=1）
--   6=教育版     开启（enabled=1）
--   7=医疗版     开启（enabled=1）
--   8=定制版     开启（enabled=1）
--
-- 幂等：ON DUPLICATE KEY UPDATE 覆盖 enabled
INSERT INTO ent_plan_features (plan_id, feature, enabled, created_at, updated_at) VALUES
(1, 6, 0, NOW(), NOW()),
(2, 6, 0, NOW(), NOW()),
(3, 6, 1, NOW(), NOW()),
(4, 6, 1, NOW(), NOW()),
(5, 6, 1, NOW(), NOW()),
(6, 6, 1, NOW(), NOW()),
(7, 6, 1, NOW(), NOW()),
(8, 6, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE enabled=VALUES(enabled), updated_at=NOW();
