ALTER TABLE cnt_article_snapshots
  DROP COLUMN gallery_refs_json;

ALTER TABLE cnt_article_generation_tasks
  DROP COLUMN gallery_refs_json;
