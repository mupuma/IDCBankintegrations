-- Additive migration. Run on the portal MySQL database before deploying this
-- version when DB_SYNC=false. No existing payment rows or tables are altered.
CREATE TABLE IF NOT EXISTS zicb_h2h_payments (
  queue_id VARCHAR(36) NOT NULL PRIMARY KEY,
  payment_key VARCHAR(64) NOT NULL UNIQUE,
  reference VARCHAR(36) NOT NULL UNIQUE,
  prcn VARCHAR(35) NOT NULL UNIQUE,
  channel VARCHAR(16) NOT NULL,
  state VARCHAR(32) NOT NULL,
  document LONGTEXT NOT NULL,
  lease_token VARCHAR(36) NULL,
  lease_until DATETIME NULL,
  next_run DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX zicb_h2h_due (next_run, lease_until)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS zicb_h2h_events (
  event_id VARCHAR(64) NOT NULL PRIMARY KEY,
  queue_id VARCHAR(36) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  payload LONGTEXT NOT NULL,
  created_at DATETIME NOT NULL,
  INDEX zicb_h2h_event_payment (queue_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payment_dispatch_reservations (
  payment_key VARCHAR(64) NOT NULL PRIMARY KEY,
  queue_id VARCHAR(100) NOT NULL,
  bank_code VARCHAR(20) NOT NULL,
  created_at DATETIME NOT NULL
) ENGINE=InnoDB;
