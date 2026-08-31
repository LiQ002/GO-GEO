ALTER TABLE cnt_article_generation_tasks
  ADD COLUMN gallery_refs_json JSON NULL AFTER knowledge_refs_json;

ALTER TABLE cnt_article_snapshots
  ADD COLUMN gallery_refs_json JSON NULL AFTER knowledge_refs_json;
