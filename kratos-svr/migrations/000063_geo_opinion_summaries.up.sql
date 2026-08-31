-- 000063: 舆情分析周期总结离线表。
-- 每个企业的每个品牌，每个周期（周/月）由 LLM 按分类生成一段舆情叙述，
-- 唯一键保证幂等（同周期同分类只保留一条，重复调度不会产生脏数据）。

CREATE TABLE IF NOT EXISTS geo_opinion_summaries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enterprise_id BIGINT UNSIGNED NOT NULL,
  brand_id BIGINT UNSIGNED NOT NULL,
  period_type VARCHAR(16) NOT NULL COMMENT 'week / month',
  period_key VARCHAR(16) NOT NULL COMMENT '周期标识：周 2026-W35，月 2026-08',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  category VARCHAR(32) NOT NULL COMMENT '分类：product/service/price/competitor/other/suggestion',
  sentiment VARCHAR(16) NOT NULL DEFAULT 'neutral' COMMENT '该分类整体倾向：positive/neutral/negative/mixed',
  content MEDIUMTEXT NOT NULL COMMENT 'LLM 生成的舆情叙述段落',
  mention_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '该周期素材提及总数（统计参考）',
  llm_model_id BIGINT UNSIGNED NULL COMMENT '生成所用写作模型 ID',
  status VARCHAR(16) NOT NULL DEFAULT 'completed' COMMENT 'completed / failed',
  generated_at DATETIME(6) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NULL COMMENT '不可变行：写入后不更新，允许 NULL',
  PRIMARY KEY (id),
  UNIQUE KEY uk_geo_opinion_summary (enterprise_id, brand_id, period_type, period_key, category),
  KEY idx_geo_opinion_summary_period (enterprise_id, period_type, period_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
