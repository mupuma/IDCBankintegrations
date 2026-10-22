-- Additive migration required before enabling recovery controls when DB_SYNC=false.
CREATE TABLE IF NOT EXISTS payment_recovery_actions (
  action_id VARCHAR(36) NOT NULL PRIMARY KEY,
  queue_id VARCHAR(100) NOT NULL,
  active_queue_id VARCHAR(100) NULL UNIQUE,
  bank_code VARCHAR(20) NOT NULL,
  action VARCHAR(32) NOT NULL,
  status VARCHAR(20) NOT NULL,
  requested_by VARCHAR(100) NOT NULL,
  reason TEXT NOT NULL,
  request LONGTEXT NOT NULL,
  result LONGTEXT NULL,
  lease_token VARCHAR(36) NULL,
  lease_until DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX payment_recovery_queue (queue_id),
  INDEX payment_recovery_work (bank_code, status, lease_until)
) ENGINE=InnoDB;
