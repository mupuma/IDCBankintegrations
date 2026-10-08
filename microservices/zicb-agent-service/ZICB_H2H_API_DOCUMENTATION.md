# ZICB H2H API Documentation

This document describes the API contract required for the IDC and ZICB H2H integration.

It contains only the technical API details needed by ZICB to implement and test the integration from their side.

## Parties

| Party | Responsibility |
| --- | --- |
| IDC ZICB H2H Agent | Sends payment requests to ZICB H2H APIs and receives payment callbacks from ZICB. |
| ZICB | Provides H2H authentication, payment submission, transaction status, and payment callback integration. |

## Environments

ZICB should provide the following base URLs per environment.

| Environment | Auth Base URL | Internal FT Base URL | RTGS Base URL | DDACC Base URL |
| --- | --- | --- | --- | --- |
| UAT | `https://<uat-auth-host>` | `https://<uat-internal-ft-host>` | `https://<uat-rtgs-host>` | `https://<uat-ddacc-host>` |
| Production | `https://<prod-auth-host>` | `https://<prod-internal-ft-host>` | `https://<prod-rtgs-host>` | `https://<prod-ddacc-host>` |

All URLs must use HTTPS.

---

# 1. Authentication

IDC authenticates to ZICB using the client credentials grant.

## Endpoint

```http
POST /h2h/auth/grant-type/client-credentials
```

## Request Headers

| Header | Required | Value |
| --- | --- | --- |
| `Content-Type` | Yes | `application/json` |

## Request Body

```json
{
  "client_id": "<client-id>",
  "client_secret": "<client-secret>",
  "grant_type": "client_credentials"
}
```

## Successful Response

```json
{
  "access_token": "<bearer-access-token>",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

## Response Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `access_token` | string | Yes | Bearer token used for payment and status requests. |
| `token_type` | string | Yes | Must be `Bearer`. |
| `expires_in` | number | Yes | Token lifetime in seconds. |

## Error Response Example

```json
{
  "error": "invalid_client",
  "message": "Invalid client credentials"
}
```

---

# 2. Token Verification

Optional endpoint used to verify an issued token.

## Endpoint

```http
GET /h2h/auth/grant-type/client-credentials/verify-token
```

## Request Headers

| Header | Required | Value |
| --- | --- | --- |
| `Authorization` | Yes | `Bearer <access-token>` |
| `Content-Type` | Yes | `application/json` |

## Expected Successful Response

ZICB may return its standard token verification success response. HTTP `200` should indicate the token is valid.

---

# 3. Payment Submission

IDC submits payments to one of three H2H payment channels.

## Channels

| Channel | Endpoint |
| --- | --- |
| Internal FT | `POST /h2h/internal-ft/send-money` |
| Other Bank RTGS | `POST /h2h/other-bank-rtgs-ft/v1/send-money` |
| Other Bank DDACC | `POST /h2h/other-bank-ddacc-ft/v1/send-money` |

## Request Headers

| Header | Required | Value |
| --- | --- | --- |
| `Authorization` | Yes | `Bearer <access-token>` |
| `Content-Type` | Yes | `application/json` |

## Common Batch Fields

All payment submission requests use a batch envelope.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `reference` | string | Yes | IDC external batch reference. ZICB must preserve this value for status checks and callbacks. |
| `count` | number | Yes | Number of transactions in the batch. Current integration sends `1`. |
| `region_code` | string | Yes | ZICB-approved region code for the configured profile. |
| `total_amount` | number | Yes | Total batch amount. Must equal the sum of transaction amounts. |
| `transactions` | array | Yes | Transaction list. Current integration sends one item. |

## Common Transaction Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `prcn_number` | string | Yes | IDC item reference. Maximum length is 35 characters. ZICB must preserve this value for status checks and callbacks. |
| `amount` | number | Yes | Transaction amount. |
| `transaction_remarks` | string | Yes | Payment remarks. Maximum length is 35 characters. |
| `is_retry` | number | Yes | Retry flag. `0` for a new item, `1` for a retry item. |
| `retry_count` | number | Yes | Retry count. `0` for a new item. |

---

# 4. Internal FT Submission

Used for transfers to ZICB internal accounts.

## Endpoint

```http
POST /h2h/internal-ft/send-money
```

## Request Body

```json
{
  "reference": "9e3520ee-7aa3-4d95-bd71-e6e7a1f7d001",
  "count": 1,
  "region_code": "101",
  "total_amount": 2500,
  "transactions": [
    {
      "prcn_number": "IDC9F8A7B6C5D4E3F2A1B0C9D8E",
      "amount": 2500,
      "transaction_remarks": "Supplier payment",
      "is_retry": 0,
      "retry_count": 0,
      "account_number": "1234567890123",
      "branch_code": "001"
    }
  ]
}
```

## Internal FT Transaction Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `account_number` | string | Yes | Beneficiary ZICB account number. Must be 13 digits. |
| `branch_code` | string | Yes | Beneficiary branch code. |

---

# 5. RTGS Submission

Used for other-bank RTGS transfers.

## Endpoint

```http
POST /h2h/other-bank-rtgs-ft/v1/send-money
```

## Request Body

```json
{
  "reference": "9e3520ee-7aa3-4d95-bd71-e6e7a1f7d002",
  "count": 1,
  "region_code": "101",
  "total_amount": 750000,
  "transactions": [
    {
      "prcn_number": "IDC1A2B3C4D5E6F7G8H9I0J1K2L",
      "amount": 750000,
      "transaction_remarks": "Supplier payment",
      "is_retry": 0,
      "retry_count": 0,
      "receiver_bic": "ABCZMLU",
      "receiver_currency": "ZMW",
      "receiver_sort_code": "123456",
      "receiver_account_number": "1234567890",
      "receiver_acc_name": "ABC Suppliers Ltd",
      "transaction_value_date": "2026-10-08"
    }
  ]
}
```

## RTGS Transaction Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `receiver_bic` | string | Yes | Receiver bank BIC/SWIFT code. |
| `receiver_currency` | string | Yes | Three-letter currency code, for example `ZMW`. |
| `receiver_sort_code` | string | Yes | Receiver bank sort code. |
| `receiver_account_number` | string | Yes | Receiver account number. |
| `receiver_acc_name` | string | Yes | Receiver account name. |
| `transaction_value_date` | string | Yes | Value date in `YYYY-MM-DD` format. |

---

# 6. DDACC Submission

Used for other-bank DDACC transfers.

## Endpoint

```http
POST /h2h/other-bank-ddacc-ft/v1/send-money
```

## Request Body

```json
{
  "reference": "9e3520ee-7aa3-4d95-bd71-e6e7a1f7d003",
  "count": 1,
  "region_code": "101",
  "total_amount": 2000,
  "transactions": [
    {
      "prcn_number": "IDC2B3C4D5E6F7G8H9I0J1K2L3M",
      "amount": 2000,
      "transaction_remarks": "Supplier payment",
      "is_retry": 0,
      "retry_count": 0,
      "receiver_bic": "ABCZMLU",
      "receiver_currency": "ZMW",
      "receiver_sort_code": "123456",
      "receiver_account_number": "1234567890",
      "receiver_acc_name": "ABC Suppliers Ltd",
      "transaction_value_date": "2026-10-08"
    }
  ]
}
```

The DDACC transaction fields are the same as RTGS transaction fields.

---

# 7. Payment Submission Response

## Successful Accepted Response

ZICB should return HTTP `202` with the following body when the batch is accepted for processing.

```json
{
  "error": null,
  "status": 201,
  "message": "Accepted",
  "h2h_tracking_number": "ZICB-H2H-TRACK-001",
  "info": []
}
```

## Required Success Indicators

IDC treats the submission as accepted when:

| HTTP Status | Body Field | Required Value |
| --- | --- | --- |
| `202` | `error` | `null` |
| `202` | `status` | `201` |

## Error Response Example

```json
{
  "error": "validation_error",
  "message": "One or more fields failed validation",
  "info": [
    {
      "prcn_number": "IDC1A2B3C4D5E6F7G8H9I0J1K2L",
      "message": "Invalid receiver account number"
    }
  ]
}
```

---

# 8. Transaction Status

IDC may query ZICB for the status of a submitted batch.

## Endpoints

| Channel | Endpoint |
| --- | --- |
| Internal FT | `POST /h2h/internal-ft/transaction-status` |
| Other Bank RTGS | `POST /h2h/other-bank-rtgs-ft/v1/transaction-status` |
| Other Bank DDACC | `POST /h2h/other-bank-ddacc-ft/v1/transaction-status` |

## Request Headers

| Header | Required | Value |
| --- | --- | --- |
| `Authorization` | Yes | `Bearer <access-token>` |
| `Content-Type` | Yes | `application/json` |

## Request Body

```json
{
  "ext_batch_ref_no": "9e3520ee-7aa3-4d95-bd71-e6e7a1f7d002"
}
```

## Successful Response

```json
{
  "error": null,
  "ext_batch_ref_no": "9e3520ee-7aa3-4d95-bd71-e6e7a1f7d002",
  "transactions": [
    {
      "prcn_number": "IDC1A2B3C4D5E6F7G8H9I0J1K2L",
      "amount": 750000,
      "currency": "ZMW",
      "receiver_account_number": "1234567890",
      "status": "completed",
      "is_still_processing": false,
      "bank_reference": "ZICB-BANK-REF-001"
    }
  ]
}
```

## Status Response Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `error` | string/null | Yes | `null` when the status lookup succeeds. |
| `ext_batch_ref_no` | string | Yes | Must match the submitted batch `reference`. |
| `transactions` | array | Yes | List of transaction status items. |

## Transaction Status Item Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `prcn_number` | string | Yes | Must match the submitted transaction `prcn_number`. |
| `amount` | number | Yes | Must match the submitted amount. |
| `currency` | string | Required for RTGS/DDACC | Must match the submitted receiver currency. |
| `receiver_account_number` | string | Required for RTGS/DDACC | Receiver account number. |
| `account_number` | string | Required for Internal FT | Internal beneficiary account number. |
| `status` | string | Yes | ZICB transaction status. |
| `is_still_processing` | boolean | Yes | `true` if still processing, `false` when final. |
| `bank_reference` | string | Required when paid | ZICB bank reference for the completed transaction. |
| `bank_callback_reference` | string | Optional | Alternative bank reference field accepted by IDC. |

---

# 9. ZICB Callback Authentication

Before calling a payment callback endpoint, ZICB must request a callback token from the corresponding auth endpoint.

## RTGS Callback Auth Endpoint

```http
POST /api/v1/bank/other-bank-rtgs-ft/auth/token
```

## DDACC Callback Auth Endpoint

```http
POST /api/v1/bank/other-bank-ddacc-ft/auth/token
```

## Internal FT Callback Auth Endpoint

```http
POST /api/v1/bank/internal-ft/auth/token
```

## Request Headers

| Header | Required | Value |
| --- | --- | --- |
| `Content-Type` | Yes | `application/json` |

## Request Body

```json
{
  "username": "<callback-username>",
  "password": "<callback-password>"
}
```

## Successful Response

```json
{
  "token": "<callback-bearer-token>"
}
```

ZICB must use this token in the matching callback endpoint.

---

# 10. Payment Callback

ZICB sends final payment status notifications to the IDC ZICB H2H Agent.

## RTGS Callback Endpoint

```http
POST /api/v1/bank/other-bank-rtgs-ft/callback
```

## DDACC Callback Endpoint

```http
POST /api/v1/bank/other-bank-ddacc-ft/callback
```

## Internal FT Callback Endpoint

```http
POST /api/v1/bank/internal-ft/callback
```

## Request Headers

| Header | Required | Value |
| --- | --- | --- |
| `Authorization` | Yes | `Bearer <callback-bearer-token>` |
| `Content-Type` | Yes | `application/json` |

## Successful Payment Callback Body

```json
{
  "reference": "9e3520ee-7aa3-4d95-bd71-e6e7a1f7d002",
  "prcn_number": "IDC1A2B3C4D5E6F7G8H9I0J1K2L",
  "status_code": 200,
  "bankRef": "ZICB-BANK-REF-001",
  "message": "DISBURSED"
}
```

## Failed Payment Callback Body

```json
{
  "reference": "9e3520ee-7aa3-4d95-bd71-e6e7a1f7d002",
  "prcn_number": "IDC1A2B3C4D5E6F7G8H9I0J1K2L",
  "status_code": 400,
  "message": "FAILED"
}
```

## Callback Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `reference` | string | Yes | Must match the submitted batch `reference`. |
| `prcn_number` | string | Yes | Must match the submitted transaction `prcn_number`. |
| `status_code` | number | Yes | `200` for disbursed, `400` for failed. |
| `bankRef` | string | Required when `status_code` is `200` | ZICB bank reference for the completed payment. |
| `message` | string | Optional | ZICB status message. |

## Successful Callback Response

```json
{
  "status_code": 200,
  "message": "success"
}
```

## Callback Error Responses

### Invalid Token

```json
{
  "error": "unauthorized",
  "message": "Missing or invalid Authorization header"
}
```

### Invalid Payload

```json
{
  "error": "validation_error",
  "message": "reference is required and cannot be empty"
}
```

### Duplicate Callback

```json
{
  "error": "duplicate_reference",
  "message": "Reference has already been processed"
}
```

---

# 11. Reference Handling

ZICB must preserve and return the following values exactly as received from IDC.

| IDC Field | Where ZICB Receives It | Where ZICB Must Return It |
| --- | --- | --- |
| `reference` | Payment submission batch | Transaction status `ext_batch_ref_no` and callback `reference` |
| `prcn_number` | Payment submission transaction item | Transaction status item and callback `prcn_number` |

ZICB should not transform, truncate, regenerate, or replace these references.

---

# 12. Connectivity Requirements

## ZICB Provides To IDC

| Item | Description |
| --- | --- |
| Auth base URL | Base URL for client credentials authentication. |
| Internal FT base URL | Base URL for internal transfer operations. |
| RTGS base URL | Base URL for RTGS operations. |
| DDACC base URL | Base URL for DDACC operations. |
| Client ID | OAuth client ID per approved profile/environment. |
| Client secret | OAuth client secret per approved profile/environment. |
| Profile ID | ZICB-approved profile ID. |
| Region code | ZICB-approved region code. |
| Currency | Approved source profile currency. |
| Amount scale | Approved decimal precision for amounts. |
| Enabled channels | One or more of `INTERNAL`, `RTGS`, `DDACC`. |

## IDC Provides To ZICB

| Item | Description |
| --- | --- |
| ZICB H2H Agent public base URL | Public HTTPS base URL for ZICB callback calls. |
| Callback auth endpoints | Endpoints listed in section 9. |
| Callback endpoints | Endpoints listed in section 10. |
| Callback username | Username for callback token requests. |
| Callback password | Password for callback token requests. |

---

# 13. Health Check

IDC ZICB H2H Agent health endpoint.

```http
GET /health
```

Successful response:

```json
{
  "status": "ok",
  "service": "zicb-h2h-agent",
  "protocol": "h2h-v1"
}
```

