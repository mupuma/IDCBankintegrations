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

## Next milestone: agent onboarding

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

Remaining work before arbitrary agents can be activated: implement authenticated
manifest discovery and capability validation, encrypted configuration delivery,
scoped agent identities, generic queue/outcome adapters with submission checkpoints,
and connection/UAT activation checks. Private keys and secret configuration must
never be returned through browser listing APIs or written into manifests/audits.
Existing IZB pull, ZICB H2H, and Zanaco ZWS remain on their tested protocols until
their adapters meet that contract. Configurable branding is a subsequent step.

Tests use in-memory database adapters. Verify real MySQL schema creation,
concurrent edits, and an enabled/disabled UAT payment in the target deployment.
