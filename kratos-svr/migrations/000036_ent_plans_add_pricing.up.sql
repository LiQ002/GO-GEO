-- 为 ent_plans 增加商业字段：定价、计费周期、可见性、排序、系列分组、赠送点数。
-- 配合套餐与计费模块（见 docs/套餐与计费模块设计文档.md §4.1）。
-- 一个 plan = 一个可售 SKU（含定价 + 额度 + 功能开关 + 赠送点数）；
-- 行业变体作为同 series_code 下的独立 plan，各自定价，不引入"行业加价规则表"。
ALTER TABLE ent_plans
  ADD COLUMN description VARCHAR(1024) NULL AFTER name,
  ADD COLUMN monthly_price_minor_units BIGINT NOT NULL DEFAULT 0 AFTER status,
  ADD COLUMN yearly_price_minor_units BIGINT NOT NULL DEFAULT 0 AFTER monthly_price_minor_units,
  ADD COLUMN currency CHAR(3) NOT NULL DEFAULT 'CNY' AFTER yearly_price_minor_units,
  ADD COLUMN billing_cycle VARCHAR(32) NOT NULL DEFAULT 'yearly' AFTER currency,
  ADD COLUMN visible_to_enterprise BOOLEAN NOT NULL DEFAULT TRUE AFTER billing_cycle,
  ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER visible_to_enterprise,
  ADD COLUMN series_code VARCHAR(64) NOT NULL DEFAULT '' AFTER sort_order,
  ADD COLUMN granted_points BIGINT NOT NULL DEFAULT 0 AFTER series_code;

-- 企业工作台"购买套餐"列表按 series_code 分组、visible_to_enterprise 过滤、sort_order 排序查询。
ALTER TABLE ent_plans
  ADD KEY idx_ent_plans_series (series_code, visible_to_enterprise, sort_order);
