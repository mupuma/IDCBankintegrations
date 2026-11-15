# Fixed payment processed timestamp

`payment_queue_requests.processed_at` stores the portal receipt time of the first accepted final bank status for an instruction, in UTC with millisecond precision. It is independent of `updated_at`.

IZB success/failure notifications, ZICB H2H callbacks/status reports and Zanaco final outcome reports capture the server time before database work. Final status and processed time are saved together. `COALESCE(processed_at, received_time)` prevents concurrent callbacks, replays, later status changes or recovery updates from replacing an existing timestamp. Corrected new instructions begin with their own empty processed time. Pending, accepted, unknown, review-only and explicitly never-sent outcomes do not receive a bank processed timestamp.

The queue, modal and reports show Payment processed separately from Last updated. UI times use Africa/Johannesburg (UTC+2) and include seconds; CSV exports preserve the full UTC timestamp, including milliseconds. Date-based reconciliation uses the fixed column and never falls back to the last modification time.

## Deployment

When portal schema synchronization is enabled (`DB_SYNC` is not `false`), startup adds the nullable MySQL column and backfills available saved server receipt timestamps. Historical approximations based on last-updated dates are excluded. A failed historical backfill does not block login or Sage reads.

If `DB_SYNC=false`, run `sql/add_payment_processed_at.sql` against the portal MySQL database before deploying/restarting the new portal. This idempotent migration adds the column and backfills eligible saved timestamps without replacing existing values. No Sage schema or data is modified.

Historical rows without a recoverable saved receipt timestamp remain null and show Not recorded. They remain visible in all-date reports; a processed-date range cannot assign an invented date to those rows.
