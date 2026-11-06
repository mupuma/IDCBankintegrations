-- Portal MySQL only. Do not run against Sage SQL Server.
-- Back up the portal database before applying. Existing add-only schema sync
-- does not widen these columns; apply this migration to existing deployments.
ALTER TABLE processed_transactions
  MODIFY COLUMN credit_amount DECIMAL(19, 2) NOT NULL,
  MODIFY COLUMN debit_amount DECIMAL(19, 2) NOT NULL;
