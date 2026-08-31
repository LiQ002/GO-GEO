-- 投放任务改造：多文章 × 多平台 + 去重（与"后续设计方向.md" §4.2 对齐）
-- 就这三条 SQL，不建新表。

-- 1. pub_plans：文章字段改为可空，增加去重策略
ALTER TABLE pub_plans
  MODIFY COLUMN article_id BIGINT UNSIGNED NULL,
  MODIFY COLUMN article_snapshot_id BIGINT UNSIGNED NULL,
  ADD COLUMN dedup_strategy VARCHAR(32) NOT NULL DEFAULT 'no_dedup'
    COMMENT '不去重=no_dedup / 全部去重=all_unique / 单平台去重=per_platform'
    AFTER failure_policy_json;

-- 2. pub_tasks：补上 article_id，用于去重查询和列表展示
ALTER TABLE pub_tasks
  ADD COLUMN article_id BIGINT UNSIGNED NOT NULL AFTER publish_plan_id,
  ADD KEY idx_pub_task_article (enterprise_id, article_id, publish_channel_id);

-- 3. 迁移历史数据：已有 pub_plans 的单文章数据写回对应的 pub_tasks
UPDATE pub_tasks t
  JOIN pub_plans p ON t.publish_plan_id = p.id
  SET t.article_id = p.article_id
  WHERE t.article_id = 0;
