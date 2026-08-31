-- 撤销：无法精确恢复原始状态，统一回退为草稿
UPDATE cnt_articles
SET status = 'draft'
WHERE status IN ('pending_review', 'normal', 'disabled');
