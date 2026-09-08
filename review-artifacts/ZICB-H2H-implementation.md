# ZICB H2H implementation and UAT handoff

The seven requested work items are implemented as a separately selectable H2H v1 path. Existing `.env` files have not been edited and no services or payment jobs were started for this work.

## Implemented behavior

1. **Payment states:** queued, submitting, accepted, unknown, paid, failed, rejected and needs_review. Acceptance cannot establish settlement. Expired submission leases become unknown and reconcile the original reference. Contradictory terminal notifications are held for review.
2. **New payloads:** shared Internal FT, RTGS and DDACC contracts in `shared/zicb-h2h`. The initial portal workflow submits one item per batch. Validation covers required fields, internal account length, date validity, currency format, decimal precision/totals, PRCN uniqueness/length, narration length and retry metadata. TT is not an H2H channel. NFS and multi-item portal aggregation remain outside this migration's seven-item scope.
3. **Persistence and duplicates:** `zicb_h2h_payments` stores immutable canonical payment, request, source/profile and references alongside lifecycle data. `zicb_h2h_events` records claims, reports, callbacks and accounting results. Database uniqueness reserves each payment's identity; shared dispatch reservations prevent racing new bank selections. Existing queue records are checked before reservation. Historical data is not automatically backfilled or resubmitted.
4. **Authentication:** configurable profile-specific URLs/credentials, cached Bearer tokens, single-flight token refresh, early expiry margin and one refresh/replay only for a definite invalid_token response. Network failures never replay send-money. Token verification and Internal/RTGS/DDACC lookup client methods are available for onboarding diagnostics; automatic reference-directory/calendar enforcement is not yet part of submission preflight.
5. **Callbacks and reconciliation:** RTGS/DDACC auth and callback paths follow the specification. Tokens are fresh, expire after five minutes and are channel-bound. Internal paths require explicit bank-confirmed configuration. Events are recorded before acknowledgment; duplicates return 409 as documented. Polling uses the original batch reference, validates item identity/account/amount and does not infer success from batch status alone. The two-hour scheduling default is an operational choice pending bank rate-limit clarification.
6. **Sage isolation:** only paid items can claim accounting work. Canonical amounts replace reads from nested bank payloads. A stable 22-character accounting reference, SQL Server transaction and transaction-owned application lock protect against partial writes, concurrent batch allocation and lost commit responses. Accounting/reporting retries never submit another transfer. The existing Sage helper hardcodes ZMW FX fields, so non-ZMW accounting is explicitly held for review instead of silently posting in the wrong currency. Other portal cashbook writes now also use the same transaction/application lock to coordinate batch allocation.
7. **Offline verification:** contract/client/worker/security tests use simulated responses; ledger tests execute the actual orchestration against an in-memory transactional adapter. These test our lifecycle logic, not live MySQL/SQL Server locking, bank connectivity or settlement.

## Configuration and migration

Before deploying this code with `DB_SYNC=false`, apply `idcbanksinegration/sql/add_zicb_h2h_ledger.sql` to the portal MySQL database. It creates three new tables and does not modify existing payment data. The dispatch-reservation table is used by new legacy submissions too, so this schema prerequisite applies even while H2H is disabled. If add-only schema sync is enabled, the registered models create missing tables instead. Explicit migration is preferable for UAT/production.

Use the new `.env.h2h.example` files in the portal and ZICB service as templates. Merge confirmed settings into the deployment's secret/configuration system; do not overwrite existing `.env` files wholesale.

Portal settings:

- `ZICB_H2H_ENABLED`: enables the new submission/claim path.
- `ZICB_H2H_AGENT_KEY`: dedicated internal agent credential, also supplied to the agent.
- `ZICB_H2H_WEBHOOK_USERNAME`, `ZICB_H2H_WEBHOOK_PASSWORD`, `ZICB_H2H_WEBHOOK_SIGNING_KEY`: credentials registered with ZICB, plus a signing key of at least 32 characters.
- `ZICB_H2H_SOURCE_PROFILES`: mapping from existing source account codes to approved profile ID, region code, currency, decimal scale, enabled channels and Sage cashbook account. Confirm with ZICB how this profile selects the actual debit account before activation.
- `ZICB_H2H_INTERNAL_AUTH_PATH`, `ZICB_H2H_INTERNAL_CALLBACK_PATH`: set only after ZICB confirms the paths; they must start with `/api/v1/bank/` and must not collide with RTGS/DDACC routes.
- `ZICB_H2H_RECONCILE_MS`: bank query spacing per unresolved item, default 7,200,000 ms. Confirm actual rate limits and expected settlement times.

Agent settings:

- `ZICB_H2H_ENABLED=true`, `APP_API_URL` and the matching `ZICB_H2H_AGENT_KEY`.
- `ZICB_H2H_PROFILES`: profile ID mapped to clientId/clientSecret and the Auth/Internal/RTGS/DDACC HTTPS base URLs. The IDs must match the portal source profiles.

The shared module must be deployed alongside the agent and portal. The agent Dockerfile now uses the repository root as build context. Next.js tracing includes the shared directory. Do not launch an old built `dist/server.js` after editing source; build the service first.

## API paths

| Path | Caller and purpose |
|---|---|
| `POST /api/v1/posted_payments` | Existing permitted portal user flow; H2H-enabled ZICB creates a durable instruction and returns 202. |
| `GET /api/v1/zicb/h2h/config` | Permitted portal users; returns only enabled state and display-validation precision. |
| `POST /api/v1/zicb/h2h/work` | Agent claims one due submission, reconciliation or accounting action. |
| `PATCH /api/v1/zicb/h2h/work` | Agent records the result for its lease; repeated reports are idempotent. |
| `POST /api/v1/zicb/h2h/accounting` | Agent executes a claimed paid-item accounting action. |
| `POST /api/v1/bank/other-bank-rtgs-ft/auth/token` | ZICB obtains a callback token. |
| `POST /api/v1/bank/other-bank-rtgs-ft/callback` | ZICB reports an RTGS item outcome. |
| `POST /api/v1/bank/other-bank-ddacc-ft/auth/token` | ZICB obtains a DDACC callback token. |
| `POST /api/v1/bank/other-bank-ddacc-ft/callback` | ZICB reports a DDACC item outcome. |

Internal agent routes require `x-zicb-agent-key`. Legacy `/posted_payments/response` now requires `x-bank-api-key` and rejects H2H records. Legacy dispatch paths skip persisted H2H protocol markers even if the rollout switch is later disabled.

## Recovery and cutover

Drain/reconcile pre-existing legacy ZICB jobs before switching the running agent. Do not translate or replay them as H2H instructions. Test with UAT credentials and test beneficiaries, then reconcile bank references against portal/Sage records before enabling production.

Unknown submissions retain their original identity and are queried later. A 404 or timeout is not authorization to create a replacement reference. Failed/rejected instructions remain reserved; automatic failed-item resubmission is intentionally disabled until ZICB confirms its reference and retry rules. Configuration rejections and conflicting outcomes currently require operator investigation; do not delete reservations to retry payments.

Paid items retry transient accounting failures independently. Missing accounting configuration or non-ZMW accounting enters accounting needs_review; correct/configure and review before manually scheduling accounting recovery. Do not alter the payment outcome or resend money to recover accounting. There is no automated FX accounting or operator override/resubmission endpoint in this version.

Disabling H2H stops new H2H submissions/claims; bank callback receivers and result recording remain available to preserve in-flight outcomes. Persisted H2H records never fall back to the legacy sender. Continue reconciliation with the H2H worker until outstanding items are resolved rather than treating a switch-off as settlement cancellation.

## UAT checks still required

Verify actual MySQL uniqueness/rollback/lease behavior under concurrent agents and SQL Server application-lock permission, Sage transaction atomicity and cashbook mappings. Exercise callback-before-response, duplicate notifications, response loss after bank acceptance, process restart, portal outage and response loss after Sage commit. Confirm rate limits, Internal callback paths, terminal statuses and source-profile routing with ZICB. Runtime connectivity and these live database behaviors have not been tested by the offline suite.
