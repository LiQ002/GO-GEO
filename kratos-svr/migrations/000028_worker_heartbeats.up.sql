CREATE TABLE IF NOT EXISTS wrk_heartbeats (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  worker_node_id BIGINT UNSIGNED NOT NULL,
  active_tasks INT UNSIGNED NOT NULL DEFAULT 0,
  metrics_json JSON,
  received_at DATETIME(6) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY(id),
  KEY idx_wrk_heartbeat_node(worker_node_id, received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
