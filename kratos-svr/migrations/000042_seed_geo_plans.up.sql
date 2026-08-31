-- 细软 GEO 产品版本种子数据
-- 参考：细软GEO产品与销售流程_融合版_内嵌版.html 产品版本模块
-- 三大类：普通行业版(3档) / 特殊行业版(4档) / 定制版(1档)
--
-- 指标说明（精简后，共7个有效指标）：
--   1 = 文章生成次数 (article_generations)
--   2 = 发布任务数 (publish_tasks)
--   3 = GEO 检测次数 (geo_queries)
--   4 = 知识库容量 (knowledge_bytes)
--   6 = AI 蒸馏次数 (ai_distills)
--   7 = 品牌档案数 (brand_keywords)
--   9 = 关键词总数 (custom_keywords)
--
-- 已移除的死指标：
--   5 = AI Token数 (无业务入口)
--   8 = 产品核心词数 (无创建入口)
--   10 = AI 衍生长尾词数 (蒸馏产出 Question 而非 Keyword)

-- ============ 套餐主体 ============
-- 幂等写入：ON DUPLICATE KEY UPDATE 覆盖商业字段，便于重跑与管理员后续修改后不回退
-- 普通行业版
INSERT INTO ent_plans (id, code, name, description, status, half_yearly_price_minor_units, yearly_price_minor_units, currency, billing_cycle, visible_to_enterprise, sort_order, series_code, granted_points, created_at, updated_at) VALUES
(1, 'standard_starter', '入门版', '普通行业版·入门版，适合工业制造等区域类推广，半年期标准化服务', 1, 880000, 0, 'CNY', 'half_yearly', 1, 1, 'standard', 0, NOW(), NOW()),
(2, 'standard_basic', '基础版', '普通行业版·基础版，适合工业制造/农产品品牌/医生个人/ToB餐饮，年期标准化服务', 1, 0, 1280000, 'CNY', 'yearly', 1, 2, 'standard', 0, NOW(), NOW()),
(3, 'standard_premium', '升级版', '普通行业版·升级版（推荐），适合工业制造/农产品/本地商业/食品饮料/消费品牌/医生个人/ToB餐饮，年期服务，含进阶看板与TOP3排名保障', 1, 0, 1980000, 'CNY', 'yearly', 1, 3, 'standard', 0, NOW(), NOW()),
-- 特殊行业版
(4, 'special_tourism', '旅游版', '特殊行业版·旅游版，含旅游行业新闻媒体及垂类媒体平台，半年/年期可选', 1, 998000, 1980000, 'CNY', 'yearly', 1, 4, 'special', 0, NOW(), NOW()),
(5, 'special_catering', 'ToC餐饮版', '特殊行业版·ToC餐饮版，含旅游行业新闻媒体及垂类媒体平台（同旅游版配置），半年/年期可选', 1, 998000, 1980000, 'CNY', 'yearly', 1, 5, 'special', 0, NOW(), NOW()),
(6, 'special_education', '教育版', '特殊行业版·教育版，含教育行业新闻媒体及垂类媒体平台，半年/年期可选', 1, 1998000, 3980000, 'CNY', 'yearly', 1, 6, 'special', 0, NOW(), NOW()),
(7, 'special_medical', '医疗版', '特殊行业版·医疗版，含医疗行业新闻媒体及垂类媒体平台，年期服务', 1, 0, 2980000, 'CNY', 'yearly', 1, 7, 'special', 0, NOW(), NOW()),
-- 定制版
(8, 'custom_enterprise', '定制版', '定制版本·不限行业，按客户特定需求定制方案及报价，10万元起/年，含全部标准版模块及专属服务保障', 1, 0, 10000000, 'CNY', 'yearly', 1, 8, 'custom', 0, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  code=VALUES(code), name=VALUES(name), description=VALUES(description), status=VALUES(status),
  half_yearly_price_minor_units=VALUES(half_yearly_price_minor_units), yearly_price_minor_units=VALUES(yearly_price_minor_units),
  currency=VALUES(currency), billing_cycle=VALUES(billing_cycle), visible_to_enterprise=VALUES(visible_to_enterprise),
  sort_order=VALUES(sort_order), series_code=VALUES(series_code), granted_points=VALUES(granted_points),
  deleted_at=NULL, updated_at=NOW();

-- ============ 套餐配额限制 ============
-- period 枚举：4=total(套餐有效期内)
-- 幂等写入：ON DUPLICATE KEY UPDATE 覆盖 limit_value / period
--
-- 套餐设计说明：
--   入门版：基础配额，适合初创企业
--   基础版：标准配额，适合成长期企业
--   升级版：高配额 + AI蒸馏，适合规模企业
--   特殊行业版：按行业定制配额
--   定制版：不限配额（按实际需求配置）

-- 入门版（普通行业版）：文章≥300/半年, 收录≥500/半年, 品牌档案1, 关键词10
INSERT INTO ent_plan_limits (plan_id, metric, limit_value, period, created_at, updated_at) VALUES
(1, 2, 300, 4, NOW(), NOW()),     -- 发布任务 ≥300篇
(1, 3, 500, 4, NOW(), NOW()),     -- GEO查询(收录) ≥500条
(1, 7, 1, 4, NOW(), NOW()),       -- 品牌档案 1个
(1, 9, 10, 4, NOW(), NOW()),      -- 关键词总数 10个
-- 基础版（普通行业版）：文章≥1000/年, 收录≥1000/年, 品牌档案2, 关键词30
(2, 2, 1000, 4, NOW(), NOW()),    -- 发布任务 ≥1000篇
(2, 3, 1000, 4, NOW(), NOW()),    -- GEO查询(收录) ≥1000条
(2, 7, 2, 4, NOW(), NOW()),       -- 品牌档案 2个
(2, 9, 30, 4, NOW(), NOW()),      -- 关键词总数 30个
-- 升级版（普通行业版）：文章≥2500/年, 收录≥4000/年, 品牌档案5, AI蒸馏50, 关键词50
(3, 2, 2500, 4, NOW(), NOW()),    -- 发布任务 ≥2500篇
(3, 3, 4000, 4, NOW(), NOW()),    -- GEO查询(收录) ≥4000条
(3, 7, 5, 4, NOW(), NOW()),       -- 品牌档案 5个
(3, 6, 50, 4, NOW(), NOW()),      -- AI蒸馏 50次
(3, 9, 50, 4, NOW(), NOW()),      -- 关键词总数 50个
-- 旅游版（特殊行业版）：文章≥1000/年, 收录≥20000/年, 品牌档案3, 关键词50
(4, 2, 1000, 4, NOW(), NOW()),    -- 发布任务 ≥1000篇（年付口径）
(4, 3, 20000, 4, NOW(), NOW()),   -- GEO查询(收录) ≥20000条（年付口径）
(4, 7, 3, 4, NOW(), NOW()),       -- 品牌档案 3个
(4, 9, 50, 4, NOW(), NOW()),      -- 关键词总数 50个
-- ToC餐饮版（特殊行业版）：同旅游版
(5, 2, 1000, 4, NOW(), NOW()),
(5, 3, 20000, 4, NOW(), NOW()),
(5, 7, 3, 4, NOW(), NOW()),
(5, 9, 50, 4, NOW(), NOW()),
-- 教育版（特殊行业版）：同旅游版口径
(6, 2, 1000, 4, NOW(), NOW()),
(6, 3, 20000, 4, NOW(), NOW()),
(6, 7, 3, 4, NOW(), NOW()),
(6, 9, 50, 4, NOW(), NOW()),
-- 医疗版（特殊行业版）：文章≥300/年, 收录≥10000/年, 品牌档案3, 关键词50
(7, 2, 300, 4, NOW(), NOW()),     -- 发布任务 ≥300篇
(7, 3, 10000, 4, NOW(), NOW()),   -- GEO查询(收录) ≥10000条
(7, 7, 3, 4, NOW(), NOW()),
(7, 9, 50, 4, NOW(), NOW()),
-- 定制版：不设限（大值占位，实际按定制方案配置）
(8, 2, 999999, 4, NOW(), NOW()),
(8, 3, 999999, 4, NOW(), NOW()),
(8, 7, 999, 4, NOW(), NOW()),
(8, 6, 9999, 4, NOW(), NOW()),
(8, 9, 99999, 4, NOW(), NOW())
ON DUPLICATE KEY UPDATE limit_value=VALUES(limit_value), period=VALUES(period), updated_at=NOW();

-- ============ 套餐功能开关 ============
-- feature 枚举：1=文章生成 2=知识库管理 3=发布管理 4=GEO监测 5=数据导出
-- 所有版本均包含基础功能
-- 幂等写入：ON DUPLICATE KEY UPDATE 覆盖 enabled
INSERT INTO ent_plan_features (plan_id, feature, enabled, created_at, updated_at) VALUES
(1, 1, 1, NOW(), NOW()), (1, 2, 1, NOW(), NOW()), (1, 3, 1, NOW(), NOW()), (1, 4, 1, NOW(), NOW()), (1, 5, 0, NOW(), NOW()),
(2, 1, 1, NOW(), NOW()), (2, 2, 1, NOW(), NOW()), (2, 3, 1, NOW(), NOW()), (2, 4, 1, NOW(), NOW()), (2, 5, 0, NOW(), NOW()),
(3, 1, 1, NOW(), NOW()), (3, 2, 1, NOW(), NOW()), (3, 3, 1, NOW(), NOW()), (3, 4, 1, NOW(), NOW()), (3, 5, 1, NOW(), NOW()),
(4, 1, 1, NOW(), NOW()), (4, 2, 1, NOW(), NOW()), (4, 3, 1, NOW(), NOW()), (4, 4, 1, NOW(), NOW()), (4, 5, 1, NOW(), NOW()),
(5, 1, 1, NOW(), NOW()), (5, 2, 1, NOW(), NOW()), (5, 3, 1, NOW(), NOW()), (5, 4, 1, NOW(), NOW()), (5, 5, 1, NOW(), NOW()),
(6, 1, 1, NOW(), NOW()), (6, 2, 1, NOW(), NOW()), (6, 3, 1, NOW(), NOW()), (6, 4, 1, NOW(), NOW()), (6, 5, 1, NOW(), NOW()),
(7, 1, 1, NOW(), NOW()), (7, 2, 1, NOW(), NOW()), (7, 3, 1, NOW(), NOW()), (7, 4, 1, NOW(), NOW()), (7, 5, 1, NOW(), NOW()),
(8, 1, 1, NOW(), NOW()), (8, 2, 1, NOW(), NOW()), (8, 3, 1, NOW(), NOW()), (8, 4, 1, NOW(), NOW()), (8, 5, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE enabled=VALUES(enabled), updated_at=NOW();
