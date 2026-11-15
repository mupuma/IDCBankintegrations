-- Run on the portal MySQL database, never on Sage SQL Server.
-- Safe to rerun; existing processed timestamps are never replaced.
SET @processed_column_ddl = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE payment_queue_requests ADD COLUMN processed_at DATETIME(3) NULL',
  'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_queue_requests' AND COLUMN_NAME = 'processed_at');
PREPARE processed_column_statement FROM @processed_column_ddl;
EXECUTE processed_column_statement;
DEALLOCATE PREPARE processed_column_statement;

UPDATE payment_queue_requests
SET processed_at = CASE WHEN JSON_VALID(response_payload) THEN
  CASE
    WHEN JSON_UNQUOTE(JSON_EXTRACT(response_payload, '$.recovery.notSent')) = 'true'
      OR JSON_UNQUOTE(JSON_EXTRACT(response_payload, '$.notSent')) = 'true' THEN NULL
    WHEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT(response_payload, '$.outcomeDateSource')), '') <> 'historical'
      AND JSON_UNQUOTE(JSON_EXTRACT(response_payload, '$.outcomeRecordedAt')) REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'
    THEN STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(response_payload, '$.outcomeRecordedAt')), '%Y-%m-%dT%H:%i:%s.%fZ')
    WHEN JSON_UNQUOTE(JSON_EXTRACT(response_payload, '$.protocol')) = 'izb-bank-status-v1'
      AND JSON_UNQUOTE(JSON_EXTRACT(response_payload, '$.receivedAt')) REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'
    THEN STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(response_payload, '$.receivedAt')), '%Y-%m-%dT%H:%i:%s.%fZ')
    WHEN JSON_EXTRACT(response_payload, '$.bankNotification') IS NOT NULL
      AND JSON_UNQUOTE(JSON_EXTRACT(response_payload, '$.processedAt')) REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'
    THEN STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(response_payload, '$.processedAt')), '%Y-%m-%dT%H:%i:%s.%fZ')
    ELSE NULL END ELSE NULL END
WHERE processed_at IS NULL AND response_payload IS NOT NULL
  AND status IN ('success', 'paid', 'failed', 'rejected', 'partially_completed');
