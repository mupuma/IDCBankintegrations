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
