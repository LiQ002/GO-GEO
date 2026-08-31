-- 扩大 session_ref 列长度：文心一言等平台的分享 URL 可超过 600 字符，
-- 原 varchar(255) 会触发 "Data too long for column 'session_ref'" 错误。
-- 与 citations.url 保持一致（varchar(2048)）。
ALTER TABLE geo_answer_snapshots
  MODIFY COLUMN session_ref VARCHAR(2048) NULL;
