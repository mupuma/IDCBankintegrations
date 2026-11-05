# Infratel ZICB alignment

Portal and ZICB agent aligned with master `c86e787` (ZICB flows only). Infratel branding and
ZICB-only selection are retained. No deployment credentials are copied.

The portal now uses the H2H ledger for all ZICB payments. The agent claims
submission, reconciliation and accounting work, authenticates with the bank,
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
   its callback/status result, and cashbook accounting/recovery in the portal.

Vendor bank maintenance now uses portal MySQL. Existing Sage vendor records
are read and imported without schema changes or truncating source values.
The portal upgrades its MySQL tables when DB_SYNC is enabled; if disabled,
have the portal database administrator apply the supplied MySQL migrations
for the H2H ledger, recovery actions, and vendor details/storage widths.
Never run these migrations against SQL Server. SQL Server schema changes
remain blocked; existing authorised cashbook writes and their transaction
lock remain available. Live bank and database behaviour requires UAT validation.

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
