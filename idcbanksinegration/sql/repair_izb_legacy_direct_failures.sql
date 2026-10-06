-- Repairs IZB rows that were incorrectly processed by the removed legacy
-- direct-push path. IZB is pull-only, so rows should never fail because
-- IZB_BANK_API_URL is missing.

UPDATE payment_queue_requests
SET
  status = CASE
    WHEN locked_by = 'izb-pull' OR claimed_at IS NOT NULL THEN 'pulled'
    ELSE 'queued'
  END,
  attempts = 0,
  last_error = NULL,
  response_payload = NULL,
  locked_at = CASE
    WHEN locked_by = 'izb-pull' OR claimed_at IS NOT NULL THEN locked_at
    ELSE NULL
  END,
  locked_by = CASE
    WHEN locked_by = 'izb-pull' OR claimed_at IS NOT NULL THEN 'izb-pull'
    ELSE NULL
  END
WHERE bank_code = 'IZB'
  AND status = 'failed'
  AND last_error = 'Missing IZB_BANK_API_URL environment variable';
