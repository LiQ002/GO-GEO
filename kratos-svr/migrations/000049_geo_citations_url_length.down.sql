-- 回滚：缩小回 varchar(2048)。注意：如有超过 2048 字符的 URL 会被截断丢失。
-- 生产环境不会回滚此迁移（数据安全优先），此处仅作为版本管理占位。
ALTER TABLE geo_citations
  MODIFY COLUMN url VARCHAR(2048) NOT NULL;
