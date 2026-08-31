-- 套餐定价周期从"月付(monthly)+年付(yearly)"改为"半年付(half_yearly)+年付(yearly)"。
-- ent_plans 的 monthly_price_minor_units 重命名为 half_yearly_price_minor_units。
-- ent_subscription_orders.cycle 是 VARCHAR(32)，不需要改结构，只需改取值（由业务层处理）。
ALTER TABLE ent_plans CHANGE COLUMN monthly_price_minor_units half_yearly_price_minor_units BIGINT NOT NULL DEFAULT 0;
