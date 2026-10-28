# White-label foundation

Branch `white-label` starts from master `0c8a4aa`, including cashbook retries and
payment queue searches. This milestone introduces a portal MySQL bank registry,
administration, dynamic bank lists and a versioned future-agent contract.

## Current capabilities

- Administrators use **Bank Integrations** to rename existing banks and enable
  or disable new payments independently for this deployment.
- Payment selections load enabled banks from MySQL. Queue history includes
  disabled banks. Lists refresh every 30 seconds; submission always checks the
  registry on the server, including bulk, legacy posting, and corrected attempts.
- First access inserts missing IZB, ZICB and Zanaco registrations, initially
  enabled to preserve master behaviour. Existing rows are never overwritten.
  Deactivated registrations stay deactivated after portal restarts.
- Configure the desired banks before allowing users to post in a new deployment.
  Disable is an admission control, not an emergency stop: already queued work,
  claims, callbacks, status checks, accounting and recovery continue. A corrected
  new instruction requires the bank to be enabled.
- Administrators can register another bank as a draft. Drafts cannot accept
  payments or appear in payment selectors. A name and credentials alone do not
  implement the bank's protocol.
- No bank secrets are stored in the registry. Existing agent `.env` credentials,
  authentication, URLs, financial validations and recovery protocols still apply.
- Changes require `bank_integrations:manage` (administrator only) and are audited.
  Revision checks reject stale or conflicting administrator edits.
- A registry/database failure blocks new submissions; there is no hardcoded
  fallback silently enabling a bank.

## Portal deployment

With `DB_SYNC` enabled, the existing add-only portal MySQL schema mechanism
creates `bank_integrations`. With `DB_SYNC=false`, apply
`sql/create_bank_integrations.sql` to the portal MySQL database first.
Build and restart the portal, sign in as an administrator, and open
`/bank_details/bank_integrations`. No SQL Server schema changes are required or
permitted. Each independent deployment uses its own database and agent secrets.

## Agent onboarding and configuration

Administrators can now open a custom draft's agent settings, discover its
authenticated `GET /v1/manifest`, and save fields declared by that manifest.
This is onboarding only: custom banks still cannot be activated or submit payments.
Existing IZB, ZICB and Zanaco agents continue using their current `.env` settings.

1. Set `BANK_AGENT_CONFIG_KEY` on the **portal** to a newly generated 32-byte
   base64 key: `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`.
   Keep it outside MySQL, protect `.env`, and back it up separately. A lost or
   changed key prevents decryption; restore it or re-onboard every agent.
2. Set `BANK_AGENT_ALLOWED_ORIGINS` on the portal to exact HTTPS origins separated
   by commas, for example `https://bank-agent.example.com:4405`. No paths or trailing
   slash in this allowlist. Use trusted TLS certificates; for a private CA, configure
   Node's `NODE_EXTRA_CA_CERTS` before startup. Redirects and unlisted origins fail.
3. Apply `sql/create_bank_agent_profiles.sql` to **portal MySQL** when `DB_SYNC=false`.
   Otherwise the existing add-only schema check creates this table. No SQL Server
   migrations, privileges or schema changes are needed.
4. Generate a **different token for each bank/deployment**:
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
   Install it as `BANK_AGENT_TOKEN` on that bank's compatible agent, and paste the
   same token into the portal's agent discovery form. This authenticates both
   discovery and that bank's configuration retrieval. Never share it with other agents.
5. Register a draft using the same uppercase bank code returned in the agent's
   manifest. Open agent settings, enter its HTTPS origin and token, then click
   **Verify and discover agent**. Enter the generated fields and save configuration.
6. The agent uses `GET /api/v1/agents/configuration` on the HTTPS portal, with
   `Authorization: Bearer <its dedicated token>` and `x-bank-code: <its bank code>`.
   The response contains `protocol`, `bankCode`, `revision` and `configuration`.
   This endpoint has no browser session fallback and returns `Cache-Control: no-store`.
   The agent must validate/apply settings before it implements payment execution.

Portal MySQL stores the bearer token and entire configuration encrypted with
AES-256-GCM, bound to the bank and purpose. Administrator GET/save responses show
only field metadata and saved-field names, never configuration values. Omitted
fields retain their saved values; explicit `null` clears an optional value.
Rediscovery/token rotation clears configuration so changed requirements must be
reviewed. Revision checks protect concurrent edits. Audit records contain the
action and revision, not credentials or field values.

Use `BANK_AGENT_TRUST_PROXY=true` only when the portal is reachable exclusively
through a trusted TLS proxy that overwrites `X-Forwarded-Proto`; otherwise leave it
false and serve HTTPS directly. Block direct access to the portal's HTTP listener.
Configuration retrieval over plain HTTP is refused. Cookie-authenticated admin
pages must also be served over HTTPS in deployment (`SESSION_COOKIE_SECURE=true`).

`shared/bank-agent-v1/runtime.cjs` provides a dependency-free authenticated manifest
handler and configuration client. `examples/bank-agent-v1/server.cjs` is an
onboarding reference, **not a bank payment adapter**. It binds only to loopback;
put a TLS proxy in front for deployment. For local testing only, set portal
`BANK_AGENT_ALLOW_LOOPBACK_HTTP=true`, allowlist `http://127.0.0.1:4010`, set
reference agent `BANK_CODE=DEMO`, `BANK_AGENT_TOKEN=<dedicated token>` and run
`node examples/bank-agent-v1/server.cjs` from the repository root. After saving
configuration, restart it with `PORTAL_URL=http://127.0.0.1:4000` and
`ALLOW_LOOPBACK_HTTP=true` to retrieve configuration without printing its values.

## Next milestone: generic payment execution

`shared/bank-agent-v1/index.ts` defines a manifest, canonical instruction and
outcome envelope. It is a contract for implementing adapters, not a claim that
the existing agents already expose the new endpoints. Proposed operations are:

| Endpoint | Purpose |
| --- | --- |
| `GET /v1/manifest` | Authenticated identity, supported operations/types and required configuration field metadata. Never secret values. |
| `POST /v1/payments/validate` | Validate the canonical instruction without submitting money. |
| `POST /v1/payments` | Submit/accept a stable instruction identity exactly once; acceptance is not settlement. |
| `POST /v1/payments/status` | Reconcile the original instruction/reference after uncertainty. |
| Portal claim/report routes | Scope agent credentials to that bank and verify event identity. |

Remaining work before arbitrary agents can be activated: generic queue/outcome
adapters with submission checkpoints, separate execution permissions for scoped
agent identities, and connection/UAT activation checks. Private keys and secret configuration must
never be returned through browser listing APIs or written into manifests/audits.
Existing IZB pull, ZICB H2H, and Zanaco ZWS remain on their tested protocols until
their adapters meet that contract. Configurable branding is a subsequent step.

Tests use in-memory database adapters. Verify real MySQL schema creation,
concurrent edits, and an enabled/disabled UAT payment in the target deployment.
