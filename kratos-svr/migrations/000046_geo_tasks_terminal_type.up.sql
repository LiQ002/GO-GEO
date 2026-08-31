ALTER TABLE geo_tasks
  ADD COLUMN terminal_type TINYINT UNSIGNED NOT NULL DEFAULT 1
  COMMENT '终端类型: 1=电脑端 2=移动端'
  AFTER inclusion_site_id;

ALTER TABLE geo_tasks
  ADD INDEX idx_geo_tasks_terminal (terminal_type);
