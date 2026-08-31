-- 000058: geo_mentions 增加 mention_rank 字段，记录品牌/竞品在 AI 回答中的排名（1-5，0=无法判定）。
-- 使用 mention_rank 避免与 MySQL 保留字 rank 冲突。
ALTER TABLE geo_mentions ADD COLUMN mention_rank INT UNSIGNED NOT NULL DEFAULT 0 AFTER position;

-- 回填历史数据：本品牌 mention 的 mention_rank 从 analysis.result_json.brandRank 读取。
UPDATE geo_mentions m
JOIN geo_analysis_results ar ON ar.answer_snapshot_id = m.answer_snapshot_id
SET m.mention_rank = CAST(JSON_EXTRACT(ar.result_json, '$.brandRank') AS UNSIGNED)
WHERE m.entity_type IN ('brand', 'enterprise')
  AND JSON_EXTRACT(ar.result_json, '$.brandRank') IS NOT NULL
  AND CAST(JSON_EXTRACT(ar.result_json, '$.brandRank') AS UNSIGNED) > 0;
