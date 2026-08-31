-- 回滚投放任务多文章/去重改造（与 §4.2 对齐）

-- 回滚顺序与 up 相反：
-- 1. pub_tasks：移除 article_id 列与索引
ALTER TABLE pub_tasks
  DROP KEY idx_pub_task_article,
  DROP COLUMN article_id;

-- 2. pub_plans：移除 dedup_strategy，恢复 article_id / article_snapshot_id 为 NOT NULL
--    注意：回滚前需确保所有 pub_plans 行的 article_id 和 article_snapshot_id 都已回填
ALTER TABLE pub_plans
  DROP COLUMN dedup_strategy,
  MODIFY COLUMN article_id BIGINT UNSIGNED NOT NULL,
  MODIFY COLUMN article_snapshot_id BIGINT UNSIGNED NOT NULL;
