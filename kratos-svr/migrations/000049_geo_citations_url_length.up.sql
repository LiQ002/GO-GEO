-- 扩大 geo_citations.url 列长度：Kimi 等平台引用 <a href> 会带
-- "#:~:text=<大量URL编码中文>" 的 Scroll-to-Text Fragment（浏览器"复制链接到高亮"
-- 自动生成），可达 KB 级长度，远超原 varchar(2048) 上限，触发
-- "Error 1406 (22001): Data too long for column 'url'" 错误。
--
-- 双保险策略：
-- 1. 前端 worker（geo-worker.ts:stripUrlFragment）在抓取时剥离 URL fragment
-- 2. 后端写入（worker_execution.go:truncateCitationURL）兜底截断到 2048
-- 3. DB 层扩字段到 varchar(8192) 容纳极端情况
ALTER TABLE geo_citations
  MODIFY COLUMN url VARCHAR(8192) NOT NULL;
