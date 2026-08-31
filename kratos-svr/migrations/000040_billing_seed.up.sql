-- 计费规则种子：12 项点数单价（unit_costs）+ 12 项计费项注册表（action_registry）。
-- 管理员可在 /admin/settings/billing 调整单价；charge_type + quota_metric 让计费规则自描述。
-- 详见 docs/套餐与计费模块设计文档.md §4.5 / §4.6。
-- unit_costs.points 以"点"为单位的小数存储，运行时由 BillingService 换算为毫点（×1000）。
-- action_registry 中 status=reserved 的项仅占位，后续实现业务时改 active，计费链路不动。

INSERT IGNORE INTO cfg_system_settings (namespace, key_name, value_json, description, is_sensitive, version, created_at, updated_at)
VALUES (
  'billing',
  'unit_costs',
  JSON_OBJECT(
    'ai_distill', JSON_OBJECT('title', 'AI蒸馏(次)', 'points', 1, 'unit', '次', 'charge_type', 'both', 'quota_metric', 'ai_distills'),
    'article_generation', JSON_OBJECT('title', '创作文章(篇)', 'points', 1, 'unit', '篇', 'charge_type', 'both', 'quota_metric', 'article_generations'),
    'article_publish', JSON_OBJECT('title', '投稿文章(篇)', 'points', 0, 'unit', '篇', 'charge_type', 'quota_only', 'quota_metric', 'publish_tasks'),
    'article_replicate', JSON_OBJECT('title', '复刻爆文(篇)', 'points', 2, 'unit', '篇', 'charge_type', 'both', 'quota_metric', 'article_generations'),
    'article_with_knowledge', JSON_OBJECT('title', '创作文章附带知识库(篇)', 'points', 1, 'unit', '篇', 'charge_type', 'both', 'quota_metric', 'article_generations'),
    'inclusion_query', JSON_OBJECT('title', '查询收录(问题/次)', 'points', 0.5, 'unit', '问题/次', 'charge_type', 'both', 'quota_metric', 'geo_queries'),
    'online_inclusion_query', JSON_OBJECT('title', '联网查收录(每次)', 'points', 1, 'unit', '次', 'charge_type', 'both', 'quota_metric', 'geo_queries'),
    'index_query', JSON_OBJECT('title', '指数查询/次', 'points', 10, 'unit', '次', 'charge_type', 'points_only', 'quota_metric', ''),
    'seo_publish', JSON_OBJECT('title', 'seo发布/篇', 'points', 1, 'unit', '篇', 'charge_type', 'both', 'quota_metric', 'publish_tasks'),
    'screenshot_inclusion_query', JSON_OBJECT('title', '带截图查收录(元/次)', 'points', 0.05, 'unit', '元/次', 'charge_type', 'both', 'quota_metric', 'geo_queries'),
    'ai_diagnosis', JSON_OBJECT('title', 'AI诊断(元/次)', 'points', 10, 'unit', '次', 'charge_type', 'points_only', 'quota_metric', ''),
    'ai_diagnosis_with_suggestion', JSON_OBJECT('title', 'AI诊断+优化建议(元/次)', 'points', 2, 'unit', '次', 'charge_type', 'points_only', 'quota_metric', '')
  ),
  '12 项计费项的点数单价与扣费模式（both=双扣/quota_only=只扣额度/points_only=只扣点数）',
  FALSE,
  1,
  CURRENT_TIMESTAMP(6),
  CURRENT_TIMESTAMP(6)
);

INSERT IGNORE INTO cfg_system_settings (namespace, key_name, value_json, description, is_sensitive, version, created_at, updated_at)
VALUES (
  'billing',
  'action_registry',
  JSON_OBJECT(
    'ai_distill', JSON_OBJECT('implemented', TRUE, 'biz_entry', 'KeywordDistillationUsecase.Create', 'status', 'active'),
    'article_generation', JSON_OBJECT('implemented', TRUE, 'biz_entry', 'ArticleGenerationUsecase.Create', 'status', 'active'),
    'article_with_knowledge', JSON_OBJECT('implemented', TRUE, 'biz_entry', 'ArticleGenerationUsecase.Create', 'status', 'active'),
    'article_publish', JSON_OBJECT('implemented', TRUE, 'biz_entry', 'PublishTaskUsecase.CreatePublishPlan', 'status', 'active'),
    'article_replicate', JSON_OBJECT('implemented', FALSE, 'biz_entry', '', 'status', 'reserved'),
    'inclusion_query', JSON_OBJECT('implemented', TRUE, 'biz_entry', 'GeoMonitorUsecase.CreateMonitorPlan', 'status', 'active'),
    'online_inclusion_query', JSON_OBJECT('implemented', FALSE, 'biz_entry', '', 'status', 'reserved'),
    'index_query', JSON_OBJECT('implemented', FALSE, 'biz_entry', '', 'status', 'reserved'),
    'seo_publish', JSON_OBJECT('implemented', FALSE, 'biz_entry', '', 'status', 'reserved'),
    'screenshot_inclusion_query', JSON_OBJECT('implemented', FALSE, 'biz_entry', '', 'status', 'reserved'),
    'ai_diagnosis', JSON_OBJECT('implemented', FALSE, 'biz_entry', '', 'status', 'reserved'),
    'ai_diagnosis_with_suggestion', JSON_OBJECT('implemented', FALSE, 'biz_entry', '', 'status', 'reserved')
  ),
  '计费项注册表：标记各计费项的业务实现状态，reserved 项仅占位、后续实现时改 active',
  FALSE,
  1,
  CURRENT_TIMESTAMP(6),
  CURRENT_TIMESTAMP(6)
);
