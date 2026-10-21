-- PORTAL MYSQL DATABASE ONLY. Never execute against SQL Server.
-- Run with the portal database selected (DB_NAME). Preserve existing values.
-- Widen only; leave larger VARCHAR or TEXT columns unchanged.
SET @vendor_phone_needs_widening = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vendor_bank_details'
    AND COLUMN_NAME = 'PHONE_NUMBER' AND DATA_TYPE = 'varchar'
    AND CHARACTER_MAXIMUM_LENGTH < 255
);
SET @vendor_phone_upgrade = IF(@vendor_phone_needs_widening > 0,
  'ALTER TABLE vendor_bank_details MODIFY COLUMN PHONE_NUMBER VARCHAR(255) NULL',
  'SELECT ''Vendor phone storage already supports the required length'' AS result');
PREPARE vendor_phone_stmt FROM @vendor_phone_upgrade;
EXECUTE vendor_phone_stmt;
DEALLOCATE PREPARE vendor_phone_stmt;
