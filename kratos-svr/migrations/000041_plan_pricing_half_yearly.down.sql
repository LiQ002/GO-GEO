-- 回滚：套餐定价周期从"半年付(half_yearly)+年付(yearly)"改回"月付(monthly)+年付(yearly)"。
ALTER TABLE ent_plans CHANGE COLUMN half_yearly_price_minor_units monthly_price_minor_units BIGINT NOT NULL DEFAULT 0;
