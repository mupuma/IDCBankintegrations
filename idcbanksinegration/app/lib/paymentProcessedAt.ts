import { col, fn } from 'sequelize';

export const FINAL_PAYMENT_STATUSES = ['success', 'paid', 'failed', 'rejected', 'partially_completed'];

// COALESCE executes in the same UPDATE as the final status. Concurrent or
// repeated callbacks cannot overwrite the first persisted receipt timestamp.
export function processedAtWrite(status: string | undefined, receivedAt: Date | string = new Date(), response?: unknown) {
  const evidence = response && typeof response === 'object' ? response as { notSent?: boolean; recovery?: { notSent?: boolean } } : {};
  return status && FINAL_PAYMENT_STATUSES.includes(status) && !evidence.notSent && !evidence.recovery?.notSent
    // A UTC string retains milliseconds inside Sequelize function arguments;
    // passing Date here would use its default seconds-only SQL serialization.
    ? { processedAt: fn('COALESCE', col('processed_at'), new Date(receivedAt).toISOString().replace('T', ' ').replace('Z', '')) } : {};
}

export function processedAtIso(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

// Recover only saved server receipt times. Never infer them from updated_at,
// payment/value dates, bank-supplied timestamps, or historical approximations.
export const BACKFILL_PAYMENT_PROCESSED_AT_SQL = `UPDATE payment_queue_requests
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
  AND status IN ('success', 'paid', 'failed', 'rejected', 'partially_completed')`;
