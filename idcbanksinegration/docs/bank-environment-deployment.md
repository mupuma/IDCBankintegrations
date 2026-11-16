# Master: portal and three-bank deployment configuration

These examples describe the current master flows: IZB pulls through its proxy,
ZICB uses the H2H ledger, and Zanaco uses ZWS with a Redis-backed worker.
Copy the examples and replace the blank secrets and uppercase placeholders.
Examples contain no live credentials and do not constitute bank onboarding.

## Files to copy

Run from the repository root on a fresh deployment. Preserve existing configured
files when upgrading rather than copying over them.

```bash
cp idcbanksinegration/.env.example idcbanksinegration/.env.local
cp microservices/izb-agent-service/.env.example microservices/izb-agent-service/.env
cp microservices/zicb-agent-service/.env.example microservices/zicb-agent-service/.env
cp microservices/zanaco-agent-service/.env.example microservices/zanaco-agent-service/.env
```

The portal loads `.env.local`; each agent loads `.env` from its service directory.
OS/service-manager environment variables override dotenv file values. Restart the
affected service after changing runtime settings. Build the portal with its
configured environment available as well.

| Service | Default port | Required configuration |
| --- | --- | --- |
| Portal | 3000 | Session secret, portal MySQL and Sage read credentials, shared bank keys, ZICB source profile map, Zanaco dispatch settings |
| IZB proxy | 4101 | `APP_API_URL`, `BANK_PULL_API_KEY`, bank-facing `AGENT_API_KEY` |
| ZICB H2H | 4001 | `APP_API_URL`, `ZICB_H2H_AGENT_KEY`, `ZICB_H2H_PROFILES`, callback username/password and signing key |
| Zanaco API + worker | 4003 | `APP_API_URL`, `BANK_PULL_API_KEY`, Redis, ZWS credentials, partner RSA private key and bank RSA public key |

`PORT` selects an agent's listening port. `APP_API_URL` is the portal base URL,
without an `/api` suffix. Loopback examples assume services run on the same host;
use the reachable portal hostname for separate hosts or container service names
inside a container network. Do not use one bank's URL for another bank.

## Matching settings

| Setting | Values that must match |
| --- | --- |
| `BANK_PULL_API_KEY` | Portal, IZB agent and Zanaco agent |
| `AGENT_AUDIT_API_KEY` | Portal and Zanaco agent, to record worker audit events |
| `ZICB_H2H_AGENT_KEY` | Portal and ZICB agent |
| ZICB `profileId` | Portal source profile value must equal a key in agent `ZICB_H2H_PROFILES` |
| IZB `AGENT_API_KEY` | Agent setting and the `x-api-key` header sent by IZB |
| Zanaco Redis/queue | API and worker use the same store and `ZANACO_QUEUE_NAME` |

Generate independent random shared keys and a JWT secret, for example with
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
Use that command separately for each secret. Supply the ZICB callback credentials
agreed with the bank; its local signing key must have at least 32 characters.

## Portal and source accounts

Use a portal MySQL database and a Sage SQL Server account with the required read
permissions. Configure the SQL Server port and TLS settings for that deployment.
Sage writes are disabled in code; there is no environment switch to enable them.
For HTTPS production set `SESSION_COOKIE_SECURE=true`; local HTTP development
requires `false`. The actual session duration setting is `SESSION_MAX_AGE_SECONDS`.
The example's first-admin password must be filled before first startup.

`DB_SYNC=true` adds missing portal tables/columns. With `DB_SYNC=false`, apply the
required portal SQL migrations before deployment. All three agents use the portal
for payment data; none requires Sage credentials.

In Source Accounts, assign each existing Sage account code to its processing
bank. Multiple source codes may belong to one bank. See
[Source account selection](source-account-selection.md).

## ZICB

The portal maps each Sage source code to a profile, bank-confirmed region,
currency, decimal scale and enabled channels. The agent stores the profile's
bank-issued client credentials and HTTPS base URLs. The example uses the local
profile name `institution-uat` on both sides; this name is not a bank credential.
Replace `SOURCE_CODE` with the exact source code, and add entries for other accounts.

Available channel names are `INTERNAL`, `RTGS` and `DDACC`; configure only those
enabled by the bank. URLs are base URLs, not complete auth/payment endpoints.
Do not mix UAT credentials with production endpoints.

`ZICB_H2H_RECONCILE_MS` belongs in the portal (minimum/default 60000).
`ZICB_H2H_ENABLED`, Redis, `BANK_PULL_API_KEY`, legacy bank URL/user/source-account
variables, and Sage settings are not required by the H2H agent. The agent always
starts in H2H mode. Callback credentials belong on the agent, where ZICB calls the
published auth/callback routes. The `.env.h2h.example` files are equivalent H2H
reference templates, not extra files loaded automatically.

## IZB

The bank calls the IZB proxy using its separate `AGENT_API_KEY`; the proxy calls
the portal using `BANK_PULL_API_KEY`. The active `npm start` proxy does not start
a Redis queue or post results back to Sage. It initializes its local JSON file,
so its working/data directory must be writable. `DB_PATH` is an optional override.
Final successful bank responses must include the required bank reference.

## Zanaco

The example uses the existing portal-push mode:
`ZANACO_DISPATCH_STRATEGY=portal-push` and
`ZANACO_BANK_API_URL=http://127.0.0.1:4003/payments` in the portal.
If deploying agent-pull instead, set `ZANACO_DISPATCH_STRATEGY=agent-pull`;
the worker claims portal jobs and the bank API URL is unnecessary for that mode.

Supply bank-issued `ZANACO_API_KEY`, `ZANACO_ACCESS_KEY`, `ZANACO_API_SECRET`,
and the correct environment's `ZANACO_BASE_URL`. The `ZANACO_PRIVATE_KEY` and
`ZANACO_PUBLIC_KEY` settings contain PEM **contents**, not file paths. Quoted
`\n` escapes in the example become PEM newlines. Keep response signature
verification enabled and replace both placeholder PEM bodies.

`npm start` launches the API and worker together; do not also start a second
standalone worker unintentionally. `AGENT_AUDIT_API_KEY` is required for agent
audit reporting, though payments can run without it. Use persistent Redis with
`maxmemory-policy noeviction`; retain existing queue/checkpoint/reference data
when upgrading. Do not change queue names or flush Redis to retry payments.

## Start and verify

Use Node 22, consistent with the supplied Dockerfiles. Start MySQL/SQL Server
access and Redis first, then build and start each service in its own directory:

```bash
npm ci
npm run build
npm start
```

Keep all four services running under your service manager. Agent health checks:

```bash
curl http://127.0.0.1:4101/health
curl http://127.0.0.1:4001/health
curl http://127.0.0.1:4003/health
```

Health responses confirm the HTTP services are running, not that bank credentials
are accepted. Confirm portal Sage reads, source-account availability and each
bank's UAT connectivity before processing a payment. Complete ZICB callback
onboarding and confirm Zanaco token/signature verification with bank-issued keys.

The existing Docker Compose file is a separate two-agent setup; it does not yet
describe an IZB deployment or load all per-agent example files. Use these native
service instructions for the complete three-bank setup rather than treating that
Compose file as a complete deployment recipe.
