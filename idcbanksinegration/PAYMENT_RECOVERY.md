# Zanaco and ZICB payment recovery

## Deployment

1. With `DB_SYNC=true`, the portal creates missing internal tables and adds missing columns on its first connection, including the durable recovery command and audit table. If `DB_SYNC=false`, apply `sql/add_payment_recovery_actions.sql` before starting the updated portal, along with any outstanding queue and H2H schema migrations. Automatic additions preserve existing columns and rows; they do not replace explicit migrations for changes to existing definitions.
2. Build the portal and both agents with `npm run build` in each project, then restart their deployed services. Deploy the portal and agents together so that recorded recovery evidence and the new command endpoint agree.
3. Keep `APP_API_URL` on the Zanaco agent pointing to the portal, and use the same `BANK_PULL_API_KEY` in the portal and agent. No additional recovery environment variables are needed. The ZICB agent continues using its existing H2H claim/report credentials and ledger.
4. Preserve Zanaco Redis job data, checkpoints and reference reservations across restarts. Recovery refuses to recreate a missing job. Configure persistent Redis storage and include it in backup/restore procedures.

## Using the controls

Open **Bank Queue Processing**, then **Recovery / history** on the payment. Available actions are calculated again on the server when submitted. Every action requires a reason and records its requester and outcome.

| Recorded situation | Allowed recovery |
| --- | --- |
| Authentication failed before submission, with recorded not-sent evidence | Retry connection on the same instruction after correcting connectivity or credentials. |
| Unknown, accepted, timed out, or interrupted after the submission boundary | Check status using the original bank reference. No new transfer is sent. |
| Bank result saved but portal reporting failed | Replay the saved report without contacting the payment submission endpoint. |
| Confirmed bank rejection or recorded local validation rejection | An administrator can correct beneficiary/regulatory details and confirm a new attempt. The original record is retained; the successor gets a fresh bank reference. |
| ZICB payment paid, Sage accounting incomplete | Retry accounting only, preserving the paid bank outcome. Fix the source profile cashbook configuration first if necessary. |
| Paid/completed bank payment | No further bank submission. |
| Missing Redis checkpoint, legacy failure without trusted evidence, or conflicting outcomes | Manual bank reconciliation. Error message text alone never authorises a new transfer. |

`payments:post` permits operational recovery; `payments:retry` permits a corrected new submission and is included in the administrator role only. Viewing requires `queues:read`. A new attempt cannot change the payment ID, amount, currency, source or transfer channel. Bulk and legacy service payloads cannot be corrected through this form.

Repeated clicks with the same request ID return the same action. A pending Zanaco recovery command blocks another command for that instruction. Active ZICB agent leases cannot be overridden. The shared dispatch reservation allows only one successor instruction, including concurrent requests. Reposting an already reserved failed Zanaco payment through the ordinary posting endpoint is blocked.

Zanaco commands survive portal restarts and are leased to the authenticated agent. A completed command means recovery was scheduled or its saved report replayed; inspect the queue outcome for actual bank settlement. A failed command includes its explanation in the history. ZICB recovery schedules work through the existing durable H2H ledger.

Historical `fetch failed` records remain uncertain unless the system already recorded proof that submission never started. Deploying this change does not retroactively establish that proof. For Zanaco NFS or bulk outcomes where automated settlement enquiries are unavailable, obtain bank confirmation manually.

## Verification limits

Automated tests use local bank stubs and transactional in-memory database adapters. They cover outcome rules, immutable financial fields, idempotency, permissions, restart checkpoints and ledger recovery. Validate MySQL locking, Redis persistence, bank connectivity and end-to-end accounting in UAT before production rollout.
