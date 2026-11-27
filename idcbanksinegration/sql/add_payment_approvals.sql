CREATE TABLE IF NOT EXISTS approval_workflows (
  scope VARCHAR(140) NOT NULL PRIMARY KEY,
  definition TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB;

ALTER TABLE payment_queue_requests ADD COLUMN approval_snapshot LONGTEXT NULL;
