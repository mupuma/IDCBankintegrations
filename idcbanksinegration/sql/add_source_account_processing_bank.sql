-- Portal MySQL only. Safe to rerun. Default schema sync also adds this column.
SET @source_bank_ddl = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE source_accounts ADD COLUMN processing_bank VARCHAR(12) NULL',
  'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'source_accounts' AND COLUMN_NAME = 'processing_bank');
PREPARE source_bank_statement FROM @source_bank_ddl;
EXECUTE source_bank_statement;
DEALLOCATE PREPARE source_bank_statement;
-- Preserve all Sage account codes and account details. Custom codes must be
-- assigned by an authorised bank-details maker in the Source Accounts page.
