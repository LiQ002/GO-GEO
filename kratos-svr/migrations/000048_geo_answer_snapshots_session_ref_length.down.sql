-- 回退 session_ref 列长度到 varchar(255)
-- 注意：若已有数据超过 255 字符，回退前需手动截断，否则会失败。
ALTER TABLE geo_answer_snapshots
  MODIFY COLUMN session_ref VARCHAR(255) NULL;
