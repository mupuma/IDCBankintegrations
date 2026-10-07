# IZB Agent API Documentation

This document describes the two IZB-facing endpoints exposed by the IDC IZB Agent Service.

The IZB Agent Service is the only API surface IZB should call. IZB should not call the IDC portal directly.

## Base URL

```text
https://<izb-agent-host>
```

Replace `<izb-agent-host>` with the host name or IP address provided by IDC.

## Authentication

All requests must include the shared IZB agent API key.

```http
x-api-key: <provided-api-key>
Content-Type: application/json
```

If the API key is missing or incorrect, the service returns `401 Unauthorized`.

## Flow Summary

1. IZB calls `POST /api/v1/payments/by_date` to pull approved IZB payments for a date range.
2. The agent returns the pending payments in IZB's expected payment payload format. Each payment includes a generated IDC `transactionId`.
3. The pulled payments are marked as `pulled` in the IDC portal so users can see that IZB has collected them.
4. IZB must keep the exact `transactionId` received in the pull response.
5. After IZB processes the payment and needs to post the cashbook result, IZB calls `POST /api/v1/postCBTxn`.
6. IZB must send that same `transactionId` as both the cashbook `transactionId` and `entries[].referenceNo`.
7. The IDC portal posts the cashbook transaction to Sage and updates the queue status shown to portal users.

## Critical Reference Rule

The `transactionId` returned by `POST /api/v1/payments/by_date` is the only reference IDC uses to match the cashbook post back to the pulled payment.

IZB must not replace it with:

- the payment narration, for example `Car wash`
- the beneficiary name
- IZB's own internal reference
- the `remarks` value
- the `Description` value

If two payments have the same narration, for example two separate `Car wash` payments, they will still have different generated `transactionId` values. IZB must return the correct `transactionId` for each payment.

---

# 1. Pull Payments By Date

Pulls approved IZB payments from the IDC portal for the supplied date range.

## Endpoint

```http
POST /api/v1/payments/by_date
```

## Headers

| Header | Required | Description |
| --- | --- | --- |
| `Content-Type: application/json` | Yes | Request body must be JSON. |
| `x-api-key: <provided-api-key>` | Yes | Shared API key used to authenticate IZB to the IZB Agent Service. |

## Request Body

```json
{
  "startDate": 20261001,
  "endDate": 20261006
}
```

## Request Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `startDate` | number | Yes | Start date for the payment search. Format must be `YYYYMMDD`. Example: `20261001`. |
| `endDate` | number | Yes | End date for the payment search. Format must be `YYYYMMDD`. Example: `20261006`. |

## Successful Response

```json
{
  "responseCode": "200",
  "responseMessage": "success",
  "timeStamp": "2026-10-06T05:06:37.000Z",
  "data": [
    {
      "transactionId": "IDC-9F8A7B6C5D4E3F2A1B0C9D8E",
      "accountNumber": "1234567890",
      "amount": 1500,
      "currency": "ZMW",
      "remarks": "Supplier payment",
      "vendorId": "VEND001",
      "accountName": "ABC Suppliers Ltd",
      "branchCode": "001",
      "sortCode": "123456",
      "currencyCode": "ZMW",
      "transactionDate": "2026-10-06T00:00:00.000Z",
      "transactionType": "RTGS",
      "physicalAddress": {
        "streetName": "Great East Road",
        "town": "Lusaka",
        "plotNo": "123"
      },
      "countryOfOrigin": "ZM",
      "swiftCode": "ABCZMLU",
      "transactionReference": "IDC-9F8A7B6C5D4E3F2A1B0C9D8E",
      "bankName": "Indo Zambia Bank"
    }
  ]
}
```

## Response Fields

| Field | Type | Description |
| --- | --- | --- |
| `responseCode` | string | Application-level response code. `200` means the pull request succeeded. |
| `responseMessage` | string | Human-readable response message. |
| `timeStamp` | string | Server timestamp in ISO-8601 format. |
| `data` | array | List of payments available for IZB to process. Empty array means no payments were available for the requested date range. |

## Payment Object Fields

| Field | Type | Description |
| --- | --- | --- |
| `transactionId` | string | Unique IDC transaction ID generated from the Sage payment. IZB must preserve this value and use it as the reference when posting the cashbook transaction. |
| `accountNumber` | string | Beneficiary account number. |
| `amount` | number | Payment amount. |
| `currency` | string | Payment currency. Usually `ZMW`. |
| `remarks` | string | Payment narration or remarks. |
| `vendorId` | string | IDC vendor/customer identifier. |
| `accountName` | string | Beneficiary account name. |
| `branchCode` | string | Beneficiary branch code. |
| `sortCode` | string | Beneficiary sort code. |
| `currencyCode` | string | Currency code for the transaction. Usually `ZMW`. |
| `transactionDate` | string | Payment date in ISO-8601 format. |
| `transactionType` | string | Payment type, for example `DDACCT` or `RTGS`. |
| `physicalAddress` | object/string | Beneficiary physical address information. |
| `countryOfOrigin` | string | Country of origin. |
| `swiftCode` | string | Beneficiary bank SWIFT code where applicable. |
| `transactionReference` | string | Same value as `transactionId`, included for compatibility only. IDC matching is based on `transactionId`. |
| `bankName` | string | Bank name. |

## Example cURL

```bash
curl -i -X POST "https://<izb-agent-host>/api/v1/payments/by_date" \
  -H "Content-Type: application/json" \
  -H "x-api-key: <provided-api-key>" \
  -d '{"startDate":20261001,"endDate":20261006}'
```

## Possible Errors

| HTTP Status | Response | Meaning |
| --- | --- | --- |
| `400` | `{ "error": "startDate and endDate required" }` | One or both date fields are missing. |
| `400` | `{ "error": "Invalid date format; expected YYYYMMDD integers" }` | Date fields are not in `YYYYMMDD` format. |
| `401` | `{ "error": "Unauthorized from IZB Agent Service" }` | Missing or invalid `x-api-key`. |
| `500` | `{ "error": "Portal APP_API_URL not configured" }` | Agent service is not correctly configured. IDC support action required. |

---

# 2. Post Cashbook Transaction

Posts the cashbook result back to IDC after IZB has processed a payment. This endpoint follows the Sage API cashbook contract.

## Endpoint

```http
POST /api/v1/postCBTxn
```

## Headers

| Header | Required | Description |
| --- | --- | --- |
| `Content-Type: application/json` | Yes | Request body must be JSON. |
| `x-api-key: <provided-api-key>` | Yes | Shared API key used to authenticate IZB to the IZB Agent Service. |

## Request Body

```json
{
  "transactionId": "IDC-9F8A7B6C5D4E3F2A1B0C9D8E",
  "bankCode": "IZB",
  "Description": "Supplier payment",
  "noEntries": 1,
  "creditAmount": 1500,
  "debitAmount": 1500,
  "entries": [
    {
      "entryNo": 1,
      "referenceNo": "IDC-9F8A7B6C5D4E3F2A1B0C9D8E",
      "customerNo": "VEND001",
      "noDetails": 1,
      "amount": 1500,
      "currency": "ZMW",
      "details": [
        {
          "entryDescription": "Supplier payment",
          "accountId": "1234567890",
          "amount": 1500,
          "DrCr": "Cr",
          "detailNo": 1
        }
      ]
    }
  ]
}
```

## Request Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `transactionId` | string | Yes | Unique IDC transaction ID received from `/api/v1/payments/by_date`. This must not be replaced with narration text. |
| `bankCode` | string | Yes | Bank code. For this integration use `IZB`. |
| `Description` | string | Yes | Transaction description or narration. Lowercase `description` is also accepted. |
| `noEntries` | number | Yes | Number of entries in the `entries` array. |
| `creditAmount` | number | Yes | Total credit amount for the cashbook transaction. |
| `debitAmount` | number | Yes | Total debit amount for the cashbook transaction. |
| `entries` | array | Yes | Cashbook entries to post. |

## Entry Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `entryNo` | number | Yes | Entry sequence number. Usually starts at `1`. |
| `referenceNo` | string | Yes | Entry reference. Should match the pulled payment `transactionId`. |
| `customerNo` | string | Yes | Vendor/customer identifier. Usually the `vendorId` from the pulled payment. |
| `noDetails` | number | Yes | Number of detail lines in the `details` array. |
| `amount` | number | Yes | Entry amount. |
| `currency` | string | Yes | Entry currency. Usually `ZMW`. |
| `details` | array | Yes | Detail lines for the entry. |

## Detail Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `entryDescription` | string | Yes | Detail line description. |
| `accountId` | string | Yes | Account ID for the detail line. |
| `amount` | number | Yes | Detail amount. |
| `DrCr` | string | Yes | Debit/credit indicator. Use `Dr` for debit or `Cr` for credit. |
| `detailNo` | number | Yes | Detail sequence number. Usually starts at `1`. |

## Successful Response

```json
{
  "responseCode": 200,
  "responseMessage": "saved successfully"
}
```

## Duplicate Response

If the transaction has already been posted, the service returns:

```json
{
  "responseCode": 409,
  "responseMessage": "Already Reported"
}
```

IDC treats an already-reported transaction as already processed, and the portal queue can be updated accordingly.

## Error Response

```json
{
  "responseCode": 500,
  "responseMessage": "Error processing transaction: <reason>"
}
```

## Example cURL

```bash
curl -i -X POST "https://<izb-agent-host>/api/v1/postCBTxn" \
  -H "Content-Type: application/json" \
  -H "x-api-key: <provided-api-key>" \
  -d '{
    "transactionId": "IDC-9F8A7B6C5D4E3F2A1B0C9D8E",
    "bankCode": "IZB",
    "Description": "Supplier payment",
    "noEntries": 1,
    "creditAmount": 1500,
    "debitAmount": 1500,
    "entries": [
      {
        "entryNo": 1,
        "referenceNo": "IDC-9F8A7B6C5D4E3F2A1B0C9D8E",
        "customerNo": "VEND001",
        "noDetails": 1,
        "amount": 1500,
        "currency": "ZMW",
        "details": [
          {
            "entryDescription": "Supplier payment",
            "accountId": "1234567890",
            "amount": 1500,
            "DrCr": "Cr",
            "detailNo": 1
          }
        ]
      }
    ]
  }'
```

## Important Matching Rule

To keep IDC portal users informed, IZB must preserve the original pulled payment `transactionId`.

The portal uses the following values to match a cashbook post back to the original pulled payment:

| Cashbook field | Must match pulled payment field |
| --- | --- |
| `transactionId` | `transactionId` |
| `entries[].referenceNo` | `transactionId` |

IZB must send the pulled payment's `transactionId` as both cashbook `transactionId` and `entries[].referenceNo`.

`Description`, `remarks`, amount, vendor ID, and beneficiary details are not used for matching. They can be duplicated across payments, so they are treated as descriptive fields only.

---

# Operational Notes

## Idempotency

IZB should not create a new reference when retrying a cashbook post. Retried requests should keep the same `transactionId` and `referenceNo`.

If IZB retries the same cashbook post, it must reuse the original pulled `transactionId`.

## Empty Payment Pulls

If no payments are available for the requested date range, the pull endpoint returns:

```json
{
  "responseCode": "200",
  "responseMessage": "success",
  "timeStamp": "2026-10-06T05:06:37.000Z",
  "data": []
}
```

## Date Format

The payment pull endpoint accepts dates as `YYYYMMDD` numbers.

Examples:

| Calendar Date | API Value |
| --- | --- |
| 1 October 2026 | `20261001` |
| 6 October 2026 | `20261006` |

## Required Network Access

IZB only needs network access to the IZB Agent Service base URL and the two endpoints listed in this document:

```text
POST /api/v1/payments/by_date
POST /api/v1/postCBTxn
```

