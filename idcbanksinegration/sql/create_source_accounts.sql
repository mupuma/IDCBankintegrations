CREATE TABLE IF NOT EXISTS source_accounts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  bank VARCHAR(8) NOT NULL,
  name VARCHAR(120) NULL,
  account_number VARCHAR(50) NULL,
  branch_code VARCHAR(20) NULL,
  contact VARCHAR(60) NULL,
  phone VARCHAR(30) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  notes VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_source_accounts_bank (bank),
  KEY idx_source_accounts_active (is_active)
);
