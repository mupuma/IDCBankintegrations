# ZICB PayBill H2H gap review

Reviewed 7 September 2026 against the supplied **Service Consumer / Customer API Specification v1.0, dated 3 September 2026**, all 64 PDF pages. Page references below refer to that PDF. This is a comparison with the current working-tree source, including existing uncommitted changes; it is not a comparison between two editions of the bank specification. No application code, configuration, payment records, or bank systems were changed or exercised. The extracted reference text is saved alongside this report.

**Conclusion:** retain the portal and queue infrastructure, but replace the ZICB bank adapter and redesign settlement tracking. Changing only the URL, authentication header, or field names would leave incorrect completion and retry behavior.

## 1. What we already have

| Component | Evidence in repository | Assessment |
|---|---|---|
| Payment portal, bank selection and user permissions | `idcbanksinegration/app/bank_details/payments/page.tsx`; `app/api/v1/posted_payments/route.ts` | Reusable, with ZICB-specific validation and status changes. |
| Source-account selection and Sage/local account resolution | `app/lib/sourceAccounts.ts` | Reusable for accounting and onboarding-profile mapping. New bank requests do not document the old explicit debit-account fields. |
| Persistent portal queue | `app/models/internal/PaymentQueueRequest.ts` | Stores payment identity, payload, bank, source bank, attempts, response and claim locks. Needs explicit H2H batch/item/settlement records. |
| Agent worker and Redis/BullMQ | `microservices/zicb-agent-service/src/queue.ts`, `worker.ts` | Useful execution infrastructure. Current generic retries must be split by operation and outcome. |
| Portal push and agent pull mechanisms | `app/lib/bankIntegrations.ts`; agent `index.ts`, `portalQueueClient.ts` | Both exist. ZICB defaults to portal-push, also selected in the local portal configuration. Select one dispatch owner per payment. |
| INT, RTGS and DDACCT routing concepts | Portal and agent ZICB builders | Existing code maps INT to `ZB8628`, and RTGS/DDACCT to `BNK9900`. These are legacy contracts, not implementations of the new endpoints. |
| Basic validation | Portal `payloadBuilders.ts`; agent `zicbValidation.ts` | Amount/date/currency/required-field checks exist, but validate the legacy payload. |
| Audit and duplicate-post checks | `app/lib/auditLog.ts`, `paymentPostGuard.ts`; agent `worker.ts` | Reuse and strengthen. Current checks do not provide atomic H2H item identity or callback deduplication. |
| Sage cashbook persistence and duplicate checks | Agent `sageClient.ts`; portal `cashbookService.ts` | Reusable foundation; completion trigger, source data and retry boundaries need correction. |

## 2. Contract comparison

| Area | Specification | Current gap / required change |
|---|---|---|
| Authentication, pp. 7–9 | Client credentials JSON exchange; Bearer access token; expiry returned in `expires_in`; token verification endpoint | Agent sends static `AuthKey`. Implement token acquisition, protected caching, early refresh, verification diagnostics and bounded refresh on `invalid_token`. Permission errors must not cause endless token refresh. |
| Service addresses, pp. 5–6 | Separate configurable base addresses for Auth, NFS B2W, Internal FT, RTGS and DDACC | Agent has one `ZICB_BANK_API_URL`. Add environment-specific service configuration. Distinguish portal-to-agent URL from agent-to-bank URLs. |
| Submission shape, pp. 13–17, 30–33, 38–42, 51–53 | `reference`, `count`, `region_code`, `total_amount`, `transactions[]` | Current body is `{service, request}` for one payment. Replace with batch contracts, including for a single payment. |
| Internal FT, pp. 26–37 | `/h2h/internal-ft/send-money`; item includes `prcn_number`, 13-digit `account_number`, `branch_code`, `amount`, `transaction_remarks`, `is_retry`, `retry_count` | Replace `ZB8628`. Add the 13-digit validation and internal account lookup. Remove legacy fields from the transmitted contract. |
| RTGS, pp. 38–50 | `/h2h/other-bank-rtgs-ft/v1/send-money`; receiver BIC, currency, sort code, account number/name, value date, remarks and retry fields | Replace `BNK9900` with RTGS-specific routing. Map existing beneficiary data to the new names and require BIC for every item. |
| DDACC, pp. 51–58 | `/h2h/other-bank-ddacc-ft/v1/send-money`; same payload as RTGS | Share the RTGS item schema but use the DDACC base address and path. Normalize existing `DDACCT` to the new channel internally. |
| NFS B2W, pp. 10–25 | Participant-based wallet/bank payouts; lookup, participants, send, status and callbacks | No matching ZICB implementation found. Add as a distinct channel if the institution is onboarded for it; this is additional capability beyond the existing three routes. |
| Acceptance, pp. 15, 31, 39–40, 52 | HTTP 202 means accepted and pending; example body has numeric `status: 201` | Agent currently reports this as success. Introduce accepted/awaiting-bank-outcome state. |
| Status queries, pp. 20–22, 34–35, 43–44, 54–55 | Query by `ext_batch_ref_no`; interpret each item's `is_still_processing` and detailed `status` | No bank transaction-status client or reconciliation job found. Portal UI polling currently reads our queue, not the bank. |
| Callbacks, pp. 23–25, 36–37, 49–50, 57–58 | Our backend issues a fresh callback token, validates Bearer callbacks, records item outcome and acknowledges | Existing agent report routes use a different payload/authentication scheme. Build the documented bank callback endpoints. |
| Reference data, pp. 18–19, 45–48, 56 | Participant directory, bank/branch BIC and sort codes, currencies and currency calendars | Existing account records are not these bank-provided directories. Add cacheable lookup clients and service-specific validation. |
| Error handling, p. 59 | Distinguishes credentials, permissions, duplicate batch/items, field validation and transient failures | Generic worker retries do not make these distinctions or supply bank retry metadata. Preserve structured error details and row indices. |
| Item outcomes, pp. 60–61 | Progress, paid-but-not-notified, successful, failed and uncertain-outcome descriptions | Current four queue states cannot adequately express batch/item settlement and independent accounting progress. |

## 3. Priority issues in the current pipeline

### Critical: accepted transfers would be reported as paid

Agent `zicbAgent.ts:172` checks legacy `status` strings and `responseCode`; line 270 defines success as `response.ok && !businessFailure`. A documented HTTP 202 body with `status: 201` therefore passes. `worker.ts:80` then enters Sage posting and subsequently reports success.

Required behavior: acceptance records submission only. Final callback or reconciled item status determines payment outcome. Neither HTTP success nor `batch_status: completed` proves every item was paid: p. 20 explicitly shows a completed batch containing items still processing. Unknown or malformed success-shaped responses must remain unresolved rather than becoming paid.

### Critical: timeout and follow-up failures can lead to another payment submission

`bankQueue.ts:26` defaults the agent-callback timeout to 120 seconds. The queue GET route (`posted_payments/route.ts:363`) marks stale processing records failed. `paymentPostGuard.ts:6` blocks queued/processing/success but excludes failed records, so a timeout can make an unresolved payment eligible for another post.

The worker also places bank submission and portal reporting inside one retryable job: a failed portal report after a successful bank call can throw into the retry path and cause another bank call. Its local configuration specifies `JOB_ATTEMPTS=10`; these job attempts are not the bank's `retry_count`.

Required behavior: persist the original submission identity and receipt before downstream work; reconcile ambiguous requests; retry reporting/accounting independently. Do not generate a new bank reference merely to get past a duplicate response. For genuine failed-item resubmissions, follow bank-confirmed reference/retry rules.

### High: nested payload and accounting fields disagree

The default portal-push route builds `{service, request}`. The agent preserves that as the job payment. `worker.ts:84` reads `payment.amount`, while the actual amount is `payment.request.amount`; this produces zero in the receipt it constructs. Currency and payment-reference fields have the same structural problem. Sage failures are logged, but the bank result can still be reported as successful with no independently scheduled accounting recovery.

Required behavior: persist a canonical payment separately from the outbound bank payload. Generate accounting work from the canonical item after confirmed payment, with its own durable status and idempotency key. Verify payout account mapping and currency handling; existing Sage code contains fixed ZMW currency fields. Preserve full H2H references outside Sage's shortened reference field (`cashbookService.ts:484` truncates to 22 characters).

### High: duplicate protection needs atomic guarantees

The portal duplicate check and subsequent queue insertion are separate operations. `queueId` is unique, but payment identity is not made unique by that field. Agent `/payments` can enqueue repeated submissions without a deterministic BullMQ job ID. The local JSON record upsert does not prevent duplicate bank work.

Required behavior: enforce payment identity and submission state transactionally in the central database; make queue insertion recoverable; use deterministic job identities as an additional guard. Resolve callback identity at item level, not batch reference alone. Preserve history across resubmissions.

### High: UI rules and supported channels disagree

The portal offers `TT`, while the ZICB validator accepts only INT/RTGS/DDACC equivalents. Its generic INT validation asks for SWIFT, address and country as if INT meant international (`payments/page.tsx:359`), whereas the new specification's Internal FT is a transfer within ZICB. ZICB's current general UI requirements also overrequire fields such as sort code for internal transfers.

Required behavior: explicit per-bank channel choices and validation. Confirm existing Sage INT semantics before remapping historical data. Do not route TT through an undocumented endpoint. Add NFS B2W only as a separately supported capability.

### High: bank callback security is absent

The legacy `/api/v1/posted_payments/response` route has no authentication check in its handler; the current middleware protects only `/bank_details`. Agent `/payments` likewise has no authentication middleware in the inspected source. Deployment-level network controls were not verified.

Required behavior: add bank callback credential verification and short-lived token validation, and authenticate internal submission/reporting routes. Record callbacks durably before acknowledging. Do not use the legacy callback as the new bank webhook without redesigning its authentication and contract. Redact account details and sensitive response/request data in logs.

## 4. Field mapping

| Existing value | New value / handling |
|---|---|
| Queue/payment identity | Persist a separate batch `reference` and unique item `prcn_number`; retain their mapping to the original Sage payment ID. Do not assume a free-text transaction reference is globally unique or within the limit. |
| No equivalent | Configure/resolve bank-approved `region_code`; compute `count` and `total_amount` from validated items. |
| `accountNumber` / legacy `destAcc` | Internal/NFS `account_number`; RTGS/DDACC `receiver_account_number`. Preserve leading zeros. |
| `branchCode` / `destBranch` | Internal `branch_code`; do not substitute this for the other-bank sort code. |
| `swiftCode` | RTGS/DDACC `receiver_bic`. |
| `sortCode` | RTGS/DDACC `receiver_sort_code`. |
| `accountName` | RTGS/DDACC `receiver_acc_name`. |
| `currency` / `payCurrency` | RTGS/DDACC `receiver_currency`; confirm Internal/NFS currency behavior because their documented send bodies omit currency. |
| `transactionDate` / `payDate` | RTGS/DDACC `transaction_value_date`; validate using the supported currency calendar and confirmed cutoffs. |
| `remarks` | Internal/RTGS/DDACC `transaction_remarks`; enforce RTGS/DDACC's 35-character limit, with a visible correction rather than silent truncation. |
| Worker attempts | Keep separate from `is_retry` and item `retry_count`; bank-owned automatic retries are a third concern. |
| `srcAcc`, `srcBranch`, user/customer/IP and sender details | Not documented in the new send bodies. Retain necessary internal accounting data; confirm bank profile/source-account mapping before ceasing explicit debit-account transmission. |
| No equivalent | NFS `institution_id`, selected from participants; lookup uses `participant_id`. |

Use decimal-safe arithmetic for amounts and totals. RTGS/DDACC cap `prcn_number` at 35 characters. Maximum 10 item retries is explicit for NFS and RTGS, and DDACC follows RTGS; confirm whether exactly the same cap applies to Internal FT.

## 5. Proposed implementation approach

1. **Confirm the onboarding contract.** Obtain environment URLs, credentials, enabled services, source-account/region mapping and unresolved rules below. Build local contract fixtures in parallel.
2. **Create a dedicated H2H adapter in the existing ZICB agent.** One token client, typed channel-specific request builders/response parsers, and reference-data clients. Share schemas with portal validation where practical; avoid two independent bank-payload implementations. Leave other-bank adapters behaviorally isolated.
3. **Extend central persistence.** Add batch, item, submission-attempt and callback-event records. Store immutable submitted payload, full references, channel/profile, item outcome, raw bank status/reference, retry metadata, timestamps and independent accounting status. Use database transactions for state transitions and a durable work record/outbox for handoff. Redis should execute work, not be the only record of a bank instruction. Add claim recovery that reconciles already-submitted work.
4. **Separate submission, settlement and accounting.** Submission acceptance ends only the submission job. Authenticated callbacks and scheduled bank reconciliation update the same item state machine. Successful items schedule Sage work once; failed or unresolved items do not. Sage/reporting retries must never resubmit money.
5. **Migrate existing INT/RTGS/DDACC using one-item batches first.** The spec explicitly allows one or more items, so existing user workflow can be preserved while exercising the full asynchronous lifecycle. Add multi-item aggregation after reliability is established; group only compatible channel/profile/region/currency/value-date items. Track partial success per item.
6. **Add NFS and bulk workflow as enabled scope.** Provide participant/name lookup, account masks, batch preflight, row-level errors and failed-item resubmission controls. Optional agricultural descriptive fields are not required for ordinary supplier payments.
7. **Update the portal and cut over in UAT.** Show accepted, awaiting outcome, paid, failed, needs review and accounting status, with batch/item/bank references. Extend duplicate guards to all unresolved states. Keep browser polling on our database; independently rate-limit bank queries. Pin each in-flight payment to its adapter version so rollout/rollback cannot replay legacy work through H2H.

Recommended lifecycle:

```text
Validated payment -> persisted batch/item -> submitted -> accepted / awaiting outcome
                                                   -> submission unknown -> reconciliation
Authenticated callback or bank status query -> paid / failed / needs review
Paid item -> durable Sage posting task -> accounting posted / accounting retry
```

`is_still_processing: false` establishes finality, not success. Interpret its associated bank status. Preserve exact raw strings, including the documented `proccessing` spelling. Statuses described as unable to confirm the outcome need reconciliation/review before any resend, even where the table labels them Failed. Paid-but-not-notified statuses must not trigger another transfer.

## 6. Questions the specification leaves unresolved

These are bank-contract questions, not requests for permission to do routine implementation work.

| Question | Evidence / reason |
|---|---|
| Exact Internal FT webhook auth and callback paths? | P. 36 explicitly says to confirm; p. 62 lists `/api/v1/bank/internal-ft/callback`, but no Internal FT auth route. Treat the quick-reference callback path as provisional. |
| Callback duplicate identity and redelivery behavior? | P. 25 says deduplicate by `reference`, but pp. 24/49/57 define it as batch reference and callbacks are per item. Batch-only deduplication would discard valid later items. Propose profile/channel + batch reference + PRCN + attempt-aware event handling; confirm 409 retry behavior and how conflicting/late events are represented. |
| Status polling limits? | P. 25 says the job should run “at least” once every two hours to avoid blocking, while p. 20 suggests polling again shortly. Confirm maximum frequency, scope of rate limit and handling of 429. Do not convert ambiguous wording into a claimed rate limit. |
| Which terminal states apply to Internal FT? | P. 34 uses `completed_fcub_ft_sc_notified`; p. 60 groups Internal FT under predominantly NFS status names. Obtain the complete channel-specific state list and rules for uncertain outcomes. |
| Source account and currency selection? | Legacy requests explicitly supply source account/currencies; new Internal/NFS bodies omit them. Confirm how institution credentials and `region_code` determine the paying account, and how multiple source accounts/currencies are supported. |
| Failed-item retry references and limits? | Clarify whether a confirmed failed-item retry uses a new batch reference with the same PRCN, counter initialization, Internal FT limits and duplicate behavior. Never reset item identity to bypass duplicate checks. |
| Corrected examples and response conventions? | Extended NFS example pp. 14–15 and Internal status example p. 34 repeat PRCNs despite uniqueness rules. Examples use HTTP 202 with body status 201, and HTTP 409 with body status 400. NFS acceptance p. 15 echoes `send-money-bulk-payout`, whereas the documented endpoint is `send-money`. Follow endpoint banners/field tables pending UAT confirmation. |
| Currency holiday parameter location? | P. 47 specifies POST JSON `{currency}`; p. 48's error calls it a query parameter. Confirm actual behavior. |
| Operational limits? | Maximum batch size/payload, amount precision and limits, allowed region codes, business-day/cutoff rules, mixed-currency rules, reference uniqueness scope, callback timeout/redelivery window and unknown-reference reconciliation delay are not sufficiently specified. |

## 7. Required validation before production

Contract and integration tests should cover each enabled channel, token expiry and permission failures, field lengths, exact totals, leading-zero accounts, duplicate PRCNs, 202 acceptance without Sage posting, mixed batch outcomes, authenticated and duplicate callbacks, callback/poll races, missed callbacks, unknown statuses, ambiguous submission timeouts, restart recovery, and reporting/Sage failure after bank acceptance.

Verify specifically that duplicate callbacks, portal report failures, Sage retries and deployment restarts cannot generate a second bank instruction. Reconcile every UAT item between bank reference, portal item and accounting record. Validate currencies and source-account mapping with the bank and the actual Sage configuration.

This review used source inspection and the complete supplied PDF. It did not make bank calls, run payment workers, validate live credentials, or prove deployed-system behavior. No dedicated ZICB contract test suite was found in the inspected project; builds alone would not establish compliance.
