# Infratel ZICB alignment

Portal and ZICB agent aligned with master `11bd466` (ZICB flows only). Infratel branding and
ZICB-only selection are retained. No deployment credentials are copied.

The portal now uses the H2H ledger for all ZICB payments. The agent claims
submission and reconciliation work, authenticates with the bank,
and forwards authenticated bank callbacks to the portal. Recovery and history
are available on the existing queue item. Unknown outcomes require status
reconciliation; do not create another payment or delete queued work to retry.

Supported channels match master: RTGS, DDACC (portal DDACCT), and INTERNAL
(portal INT). The old BNK9900/mobile-money path has been removed. Existing
mobile-money instructions must be reconciled separately before deployment;
do not convert them into bank transfers or replay them through H2H.

## Configuration

Keep Infratel's own database, source accounts, bank credentials and callback
credentials. The old single-bank `ZICB_H2H_PROFILE_ID`, `ZICB_H2H_REGION_CODE`,
`ZICB_H2H_CURRENCY`, and DEFAULT fallbacks are replaced by explicit source maps.

Portal `.env` (replace every placeholder):

```dotenv
ZICB_H2H_AGENT_KEY=SHARED_PORTAL_AGENT_SECRET
ZICB_H2H_RECONCILE_MS=60000
ZICB_H2H_SOURCE_PROFILES={"INFRATEL_SOURCE_CODE":{"profileId":"infratel-uat","regionCode":"BANK_APPROVED_REGION","currency":"ZMW","amountScale":2,"cashbookAccount":"FINANCE_APPROVED_GL_ACCOUNT","channels":["RTGS","DDACC","INTERNAL"]}}
```

Use the actual Sage/source-account code as INFRATEL_SOURCE_CODE. Enable only
bank-approved channels. The debit account comes from that selected source
account. There is no default source profile or legacy dispatch fallback.

Agent `.env`:

```dotenv
PORT=4001
APP_API_URL=http://YOUR_INFRATEL_PORTAL:4000
ZICB_H2H_AGENT_KEY=SHARED_PORTAL_AGENT_SECRET
ZICB_H2H_WEBHOOK_USERNAME=AGREED_CALLBACK_USERNAME
ZICB_H2H_WEBHOOK_PASSWORD=AGREED_CALLBACK_PASSWORD
ZICB_H2H_WEBHOOK_SIGNING_KEY=PRIVATE_RANDOM_VALUE_AT_LEAST_32_CHARACTERS
ZICB_H2H_PROFILES={"infratel-uat":{"clientId":"BANK_CLIENT_ID","clientSecret":"BANK_CLIENT_SECRET","authUrl":"https://BANK_AUTH_HOST:PORT","internalUrl":"https://BANK_INTERNAL_HOST:PORT","rtgsUrl":"https://BANK_RTGS_HOST:PORT","ddaccUrl":"https://BANK_DDACC_HOST:PORT"}}
```

The portal profileId must match the agent profile key exactly. Use bank base
URLs, not complete authentication endpoint paths. See the agent's
ZICB_H2H_API_DOCUMENTATION.md for callback URLs and payloads. Master runs
H2H unconditionally; ZICB_H2H_ENABLED no longer selects another protocol.

## Deployment

1. Back up the portal MySQL database. Preserve all H2H/payment queue records.
   Reconcile legacy in-flight work with ZICB before restarting submission.
2. Deploy portal, agent and shared/zicb-h2h from the same branch revision.
3. Build the agent (`npm run build`) and portal (`npm run build`) in their
   respective directories, then restart their existing systemd services.
4. Verify agent `/health`, source-profile validation, one approved UAT payment,
   its callback/status result, bank references, processed timestamp, reporting and correction recovery in the portal.

Vendor bank maintenance now uses portal MySQL. Existing Sage vendor records
are read and imported without schema changes or truncating source values.
The portal upgrades its MySQL tables when DB_SYNC is enabled; if disabled,
have the portal database administrator apply the supplied MySQL migrations
for the H2H ledger, recovery actions, and vendor details/storage widths.
Never run these migrations against SQL Server. SQL Server schema changes
remain blocked; Sage is read-only and bank outcomes are retained in portal MySQL.
Sage cashbook accounting and accounting retries are disabled. Live bank and database behaviour requires UAT validation.

## Additional ZICB flow updates

New instructions and corrected attempts use the master bank reference format
`IDC-YYYY-NNNNN`, allocated transactionally per Johannesburg calendar year.
Existing instruction references remain unchanged. IDC here is the bank reference
prefix inherited from master; the portal retains Infratel branding.
When DB_SYNC=false, apply sql/add_zicb_prcn_sequence.sql to portal MySQL before
starting the updated portal. The annual counter refuses allocations after 99999.

Accepted and unknown payments reconcile every minute by default. Explicit longer
ZICB_H2H_RECONCILE_MS settings remain effective; update existing configuration
if one-minute reconciliation is required. Older unresolved schedules are picked
up without overriding active leases. The agent drains available work immediately.

Recovery / history now offers reposting an unknown payment only with retry
permission, a recorded reason and explicit operator confirmation that it was
never sent or accepted. A not-found bank response alone is insufficient.
The original instruction, references and audit history are retained; settlement
evidence and active leases block reposting.

The ZICB agent installs shared/http-logging for redacted HTTP and webhook
exchanges. Deploy that shared directory alongside shared/zicb-h2h, including
for systemd deployments. See ../HTTP_LOGGING.md for controls.

## Master feature alignment (11bd466)

This update transfers ZICB and shared portal functionality selectively. Infratel's
login page, logos, wallpaper images, ZICB-only integration list, deployment
configuration and credentials are preserved. IZB/Zanaco agent changes are not
part of this alignment. The inherited IDC bank reference prefix remains unchanged.

- ZICB bank reports and callbacks retain their bank reference and saved response
  details locally. Confirmed healthy payments show green OK!; uncertain or failed
  outcomes retain their errors.
- Click a transaction for its summary, beneficiary/source details, references,
  processing history and full saved response. Queue search includes references,
  vendors, payment types, descriptions, amounts and status.
- Payment processed is a dedicated immutable portal receipt timestamp. Later
  callbacks, edits and recovery do not replace it. UTC timestamps are stored
  with milliseconds and shown in Johannesburg time. Records without a known
  receipt date show Not recorded.
- Operators and administrators can use daily/monthly/yearly reconciliation
  reports and complete filtered CSV exports. All-bank reports include only ZICB
  on this deployment.
- Bank Details Makers maintain details and save corrections for confirmed failed
  single payments. Payment Operators review and submit corrected attempts; they
  cannot edit the details. Administrators manage users and oversee reports/audits.
  Every correction records its actor, reason and before/after values atomically
  in the audit log. Original instructions and bank references are retained.
- Server authorization uses the current database role and denies access if that
  role lookup is unavailable. Assign staff their separate roles in User Management.
- Sage remains readable; its exact Sequelize version-check startup query is
  allowed while writes remain blocked. No Sage database changes are required.

### Database preparation

When DB_SYNC is enabled, the portal adds the processed_at field and backfills
known saved server receipt dates. When DB_SYNC=false, run
`sql/add_payment_processed_at.sql` on the portal MySQL database before deployment.
The script never replaces an existing processed timestamp or infers one from
last-updated dates. Existing H2H instructions and annual PRCN counters are kept.

Build/restart the portal and ZICB agent from this same revision. Live UAT should
verify one permitted payment, a callback/status check, its bank reference and
fixed processed time, and the report export using Infratel's own configuration.
