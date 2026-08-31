-- ent_subscriptions 补字段：激活订单 ID 与到期处理标记。
-- activated_order_id 关联 ent_subscription_orders.id，追溯开通/续费来源；
-- expired_at_processed 供到期判定 Cron 使用，避免重复处理。
-- 详见 docs/套餐与计费模块设计文档.md §4.7.1 / §10.5。
ALTER TABLE ent_subscriptions
  ADD COLUMN activated_order_id BIGINT UNSIGNED NULL AFTER plan_id,
  ADD COLUMN expired_at_processed BOOLEAN NOT NULL DEFAULT FALSE AFTER auto_renew;
