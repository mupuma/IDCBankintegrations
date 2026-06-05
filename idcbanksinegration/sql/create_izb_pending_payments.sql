CREATE TABLE IF NOT EXISTS izb_pending_payments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  payment_id VARCHAR(100) NOT NULL,
  payment_date DATETIME NULL,
  source_bank VARCHAR(100) NULL,
  payment_payload TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'queued',
  attempts INT NOT NULL DEFAULT 0,
  pulled_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_payment_date (payment_date),
  KEY idx_status (status),
  KEY idx_source_bank (source_bank)
);
