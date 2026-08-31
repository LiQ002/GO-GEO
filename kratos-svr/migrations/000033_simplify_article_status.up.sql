-- 将文章状态简化为三态：pending_review（待审核）、normal（正常）、disabled（禁用）
UPDATE cnt_articles
SET status = CASE
    WHEN status IN ('draft', 'publishing') THEN 'pending_review'
    WHEN status IN ('approved', 'published') THEN 'normal'
    WHEN status IN ('rejected', 'archived') THEN 'disabled'
    ELSE 'pending_review'
  END
WHERE status NOT IN ('pending_review', 'normal', 'disabled');
