# Zanaco Agent Service

Worker/API service for Zanaco Web Services (ZWS) payments.

## Supported ZWS Capabilities

- Internal Zanaco transfer: `ZANACO_INTERNAL`
- RTGS transfer: `ZANACO_RTGS`
- DDAC transfer: `ZANACO_DDAC`
- SWIFT transfer: `ZANACO_SWIFT`
- Masked account disbursement: `ZANACO_MASKED_DISBURSEMENT`
- Collection: `ZANACO_COLLECTION`
- Balance enquiry: `ZANACO_BALANCE_ENQUIRY`
- Transaction status: `ZANACO_TRANSFER_STATUS`
- Account lookup: `ZANACO_ACCOUNT_LOOKUP`
- Enhanced KYC: `ZANACO_ENHANCED_KYC`
- NFS name lookup/query/transfer
- RTGS/DDAC/SWIFT BIC catalogue reads
- Nexus bulk internal/RTGS/DDAC/SWIFT batch submission
- Nexus batch status/detail reads

## Required Environment

```text
PORT=4003
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
APP_API_URL=http://localhost:3000
BANK_PULL_API_KEY=...
AGENT_AUDIT_API_KEY=...

ZANACO_BASE_URL=https://uat-zws.zanaco.co.zm
ZANACO_API_KEY=...
ZANACO_ACCESS_KEY=...
ZANACO_API_SECRET=...
ZANACO_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
ZANACO_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

`ZANACO_PRIVATE_KEY` signs compact JSON request bodies using RSA-SHA256. `ZANACO_PUBLIC_KEY` verifies Zanaco response signatures when supplied.

## Payment recovery and deployment

The portal validates single payments before queue creation and checks bulk batches
against the agent's account, item-count, reference and total constraints. Batches
must have unique Sage payment IDs and a single currency, value date and transfer
type. The payment screen splits its Zanaco selections by currency and value date.
Beneficiary name and physical address must be present; bank names or the word
"Zambia" are not substituted for a missing beneficiary address. Historical Sage
dates are moved to today's value date; invalid calendar dates are rejected.

The supplied guide lists SWIFT TPIN length as 8 but demonstrates a 10-character
TPIN. Confirm this discrepancy with Zanaco before applying an exact length rule;
the existing 20-character maximum remains in both validators for now.

The worker persists its prepared bank payload and a submission marker in the
BullMQ job before contacting Zanaco. After that marker, a timeout, crash or
`ZWS-51` can only trigger a status enquiry using the saved reference. A saved
success or rejection is only reported to the portal again; it is never submitted
to the bank again because portal reporting failed. Exhausted uncertain jobs stay
`unknown` in the portal and remain in Redis for operator reconciliation. Retrying
such a failed job continues reconciliation, not payment submission.

Completed and failed jobs are retained. Queue IDs deduplicate portal deliveries,
an atomic submission marker fences overlapping/stalled workers, and
and permanent Redis reference reservations reject a reference owned by another
instruction. Portal redeliveries of retained jobs replay the saved result. Late
reports cannot downgrade a portal payment already marked success/paid.
New single-payment references use the full stable payment ID rather
than a truncated description/reference prefix. The portal and agent generate
matching references; deploy both versions together. Prepared references already
stored in checkpoints are preserved.

Before upgrading, stop the agent and reconcile legacy processing/unknown jobs
against Zanaco using their original references. Legacy retried or stalled jobs
without a checkpoint are held as unknown for manual reconciliation. Do not delete
or recreate them to bypass that hold.

Redis is the durable recovery store: configure persistence, backups and
`maxmemory-policy noeviction`. Submission safety depends on preserving the
checkpoint and reference keys. An asynchronous Redis persistence configuration
can lose acknowledged writes on a host failure; choose a durability policy that
meets your payment requirements. Do not flush Redis, auto-remove retained jobs,
or switch Redis databases/queue names during recovery. This implementation does
not establish bank-side exactly-once execution after Redis data loss.

The following optional operational settings have defaults:

```dotenv
JOB_ATTEMPTS=10
JOB_BACKOFF_MS=60000
ZANACO_REQUEST_TIMEOUT_MS=90000
ZANACO_ACCESS_TOKEN_TTL_MS=1800000
ZANACO_TOKEN_REFRESH_SKEW_MS=120000
ZANACO_REQUIRE_RESPONSE_SIGNATURE=true
```

Confirm token lifetime with Zanaco; 30 minutes is an operational default, not a
lifetime established by the supplied guide. Request timeouts cover response-body
reads. A 401 expires the cached access token for the next enquiry without
automatically replaying a payment. Startup validates bank credentials, RSA PEM
keys, HTTPS base URL and portal configuration. Environment values may contain
PEM text with `\n` separators; file paths are not accepted as key contents.

Nexus bulk `PENDING_APPROVAL` is reported as `accepted`, never settled success.
The supplied ZWS guide does not document Nexus final batch/item states. Bulk
outcomes and uncertain NFS transfers require manual reconciliation until the bank
provides their status contracts; automatic resubmission is disabled. Confirm the
exact signed response bytes for header and body signatures with Zanaco during UAT.

`npm test` rebuilds the source and exercises crash recovery, reporting failures,
signature verification, authentication, timeouts, payload validation and uncertain
bank responses with local adapters. These tests do not contact Zanaco or prove
Redis persistence/failover behavior; validate those in your deployment/UAT setup.

## Linux systemd service

`zanaco-agent.service` starts both the HTTP API and Redis worker through
`dist/server.js`. It uses `/AppFiles/IDCBankintegrations/microservices/zanaco-agent-service`
as the deployment directory and `www-data` as the service user/group, matching
the existing IZB service convention. Adjust the paths and user/group in the unit
if your deployment differs. Check `command -v node` and adjust `/usr/bin/node`
when necessary.

The application loads `.env` using its existing `dotenv/config` import.
`DOTENV_CONFIG_PATH` selects the exact file, including quoted PEM keys with
literal `\n` separators. The service checks that `.env` is readable before
starting. Existing process environment variables take precedence over `.env`;
avoid defining the same settings in systemd overrides.

On the Linux server, build and install from the deployment directory:

```bash
cd /AppFiles/IDCBankintegrations/microservices/zanaco-agent-service
npm ci --include=dev
npm run build

sudo chown root:www-data .env
sudo chmod 640 .env
sudo -u www-data test -r .env
sudo -u www-data test -r dist/server.js

sudo install -m 644 zanaco-agent.service /etc/systemd/system/zanaco-agent.service
sudo systemd-analyze verify /etc/systemd/system/zanaco-agent.service
sudo systemctl daemon-reload
sudo systemctl enable --now zanaco-agent.service
sudo systemctl status zanaco-agent.service --no-pager
```

Redis must be reachable at the address configured in `.env`. The service user
also needs directory traversal and read access to the deployed application and
`node_modules`.

After changing `.env`, restart to reload the settings:

```bash
sudo systemctl restart zanaco-agent.service
sudo journalctl -u zanaco-agent.service -n 100 --no-pager
```

With the default `PORT=4003`, check the HTTP service using
`curl http://127.0.0.1:4003/health`. This checks the HTTP API only; review the
journal for Redis, portal authentication, and bank connectivity errors.

## HTTP Usage

Queue a normal portal payment:

```json
{
  "bankCode": "ZANACO",
  "queueId": "portal-queue-id",
  "payment": {
    "transactionType": "INT",
    "transactionReference": "ABC1234567",
    "accountNumber": "9876543210123",
    "amount": 100,
    "currency": "ZMW",
    "transactionDate": "2099-01-01"
  }
}
```

Queue a direct ZWS payload:

```json
{
  "service": "ZANACO_BALANCE_ENQUIRY",
  "request": {
    "accountNumber": "1234567890123"
  }
}
```

Queue a bulk batch:

```json
{
  "service": "ZANACO_BULK_INTERNAL",
  "request": {
    "batchName": "Payroll",
    "currency": "ZMW",
    "totalCount": 1,
    "totalAmount": 100,
    "items": [
      {
        "debitAccount": "1234567890123",
        "creditAccount": "9876543210123",
        "externalTranRef": "PAYROLL001",
        "amount": 100,
        "name": "Alice Banda"
      }
    ]
  }
}
```
