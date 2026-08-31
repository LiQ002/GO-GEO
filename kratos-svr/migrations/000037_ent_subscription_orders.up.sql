-- 统一订单表：一张表承载开通/续费/加购/充值/退款五类交易，用 order_type 区分。
-- 详见 docs/套餐与计费模块设计文档.md §4.2 / §4.2.1。
-- order_type: plan / renew / addon / credits / refund
-- status: pending / paid / approved / cancelled / refunded
-- source: enterprise_self（企业自购）/ admin_grant（管理员开通）
CREATE TABLE IF NOT EXISTS ent_subscription_orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_no VARCHAR(64) NOT NULL,
  enterprise_id BIGINT UNSIGNED NOT NULL,
  plan_id BIGINT UNSIGNED,
  order_type VARCHAR(32) NOT NULL,
  cycle VARCHAR(32),
  amount_minor_units BIGINT NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'CNY',
  credits_amount BIGINT,
  addon_quota_metric VARCHAR(64),
  addon_quota_amount BIGINT,
  renew_from_subscription_id BIGINT UNSIGNED,
  refund_reference_order_id BIGINT UNSIGNED,
  points_before BIGINT,
  points_after BIGINT,
  status VARCHAR(32) NOT NULL,
  source VARCHAR(32) NOT NULL,
  paid_at DATETIME(6),
  approved_at DATETIME(6),
  approved_by BIGINT UNSIGNED,
  remark TEXT,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  deleted_at DATETIME(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_ent_order_no (order_no),
  KEY idx_ent_orders_enterprise (enterprise_id, status, created_at),
  KEY idx_ent_orders_refund (refund_reference_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
