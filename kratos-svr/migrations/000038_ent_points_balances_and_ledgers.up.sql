-- 点数余额表：每个企业一行，balance 为可用点数（毫点），frozen 为预扣冻结点数。
-- 余额与流水分离：本表用于快速校验，ent_points_ledgers 用于对账。
-- version 配合 SELECT FOR UPDATE 防并发。详见 docs/套餐与计费模块设计文档.md §4.3。
CREATE TABLE IF NOT EXISTS ent_points_balances (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enterprise_id BIGINT UNSIGNED NOT NULL,
  balance BIGINT NOT NULL DEFAULT 0,
  frozen BIGINT NOT NULL DEFAULT 0,
  version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_ent_points_balance_enterprise (enterprise_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 点数流水表（补建物理表）：Go model 已存在但物理表从未建（迁移 grep 零匹配）。
-- 追加只写表，记录点数的 grant/recharge/reserve/settle/rollback/refund/adjust。
-- 详见 docs/套餐与计费模块设计文档.md §4.4。
CREATE TABLE IF NOT EXISTS ent_points_ledgers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enterprise_id BIGINT UNSIGNED NOT NULL,
  operation VARCHAR(32) NOT NULL,
  amount BIGINT NOT NULL,
  balance_after BIGINT NOT NULL,
  frozen_after BIGINT NOT NULL,
  reference_type VARCHAR(64),
  reference_id BIGINT UNSIGNED,
  reason VARCHAR(256),
  operator_id BIGINT UNSIGNED,
  idempotency_key VARCHAR(128),
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_ent_points_ledger_idem (idempotency_key),
  KEY idx_ent_points_ledger_enterprise (enterprise_id, created_at),
  KEY idx_ent_points_ledger_ref (reference_type, reference_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
