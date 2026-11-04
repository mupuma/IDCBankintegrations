# IZB payment failure callback

When a pulled payment cannot be executed, IZB calls the agent's new endpoint. This contract must be shared with the bank; the bank must implement sending it. Successful payment notifications continue to use `POST /api/v1/postCBTxn`.

```http
POST /api/v1/payments/status
Content-Type: application/json
x-api-key: <existing IZB agent AGENT_API_KEY>
```

```json
{
  "eventId": "IZB-FAIL-20261104-00001",
  "transactionId": "IDC8A24F91C0",
  "status": "failed",
  "errorCode": "INVALID_ACCOUNT",
  "errorMessage": "Beneficiary account could not be credited"
}
```

Use the exact `transactionId` returned by the payment pull. `eventId` is a bank-generated identifier for this notification; retries must retain the same event ID and payload. `status` accepts `failed` or `rejected` only. Optional `bankReference` can identify the bank's attempt. Optional `queueId` disambiguates multiple historical instructions. Required identifiers and error code are strings up to 100 characters; `errorMessage` is a nonempty string up to 1000 characters. Financial fields are not accepted as changes to the original payment.

The agent forwards this to the portal at `POST /api/v1/izb/payment-status` using its existing `BANK_PULL_API_KEY` as `x-bank-api-key`. Configure `APP_API_URL`, `AGENT_API_KEY`, and `BANK_PULL_API_KEY` as for the existing IZB endpoints. Authentication and JSON-parser errors are returned before any update. No database migration or new credential is required.

The portal locks the matching IZB instruction, records the bank error in its queue and saves an `IZB_PAYMENT_FAILED` audit entry in the same transaction. The queue becomes `failed`; the full code/message is displayed in Bank Queue Processing. Bank failures have a **Bank failure / details** control instead of suggesting a Sage cashbook retry. No Sage entry, successful receipt or bank repost is created. Existing IZB duplicate-post guards still apply.

```json
{
  "responseCode": 200,
  "responseMessage": "Bank failure recorded; no cashbook was posted",
  "duplicate": false,
  "transactionId": "IDC8A24F91C0",
  "queueId": "<original queue ID>",
  "status": "failed"
}
```

Return codes: `200` recorded or an identical duplicate; `400` invalid payload; `401` invalid credentials; `404` unknown reference; `409` ambiguous references, reused event ID with a different payload, an instruction not awaiting a bank outcome, or conflict with an existing cashbook notification; `503` save/forwarding failure or timeout. On `503`, retry the same event ID because the portal might already have committed. An identical retry is acknowledged without another state change or audit entry. Completed payments and evidence of a bank-success cashbook notification cannot be overwritten by a new failure event. Repeated failure notifications for the same payment may use different event IDs and remain in audit history.

After deploying and restarting the portal and IZB agent, test through the agent in UAT. The existing shared HTTP logger records these exchanges. A failure does not authorise automatically sending the payment again; resolve the cause and reconcile with IZB first.
