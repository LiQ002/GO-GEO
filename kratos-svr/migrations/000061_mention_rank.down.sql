-- 000058 down: 移除 geo_mentions.mention_rank 字段。
ALTER TABLE geo_mentions DROP COLUMN mention_rank;
