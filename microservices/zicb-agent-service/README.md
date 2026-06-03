# ZICB Agent Service

A lightweight Node microservice for receiving payments from `idcbanksinegration` and forwarding them to ZICB via BullMQ.

## Features

- HTTP endpoint to receive payment requests
- BullMQ queue for retries and async processing
- ZICB-specific payload builder and sender
- Worker process for bank submission

## Setup

1. Install dependencies:

   ```bash
   cd microservices/zicb-agent-service
   npm install
   ```

2. Copy `.env.example` to `.env` and configure Redis + ZICB API URL.

3. Start the worker in one terminal:

   ```bash
   npm run dev src/worker.ts
   ```

4. Start the API in another terminal:

   ```bash
   npm run dev
   ```

## API

POST `/payments`

Request body:

```json
{
  "bankCode": "ZICB",
  "payment": {
    "paymentId": "1234",
    "accountNumber": "1234567890",
    "branchCode": "001",
    "accountName": "SageSystem",
    "amount": 1000,
    "currency": "ZMW",
    "transactionType": "DDACCT",
    "transactionDate": "2026-05-28",
    "transactionReference": "REF001",
    "remarks": "Payment through ZICB agent"
  }
}
```

## Environment

- `PORT` - HTTP server port
- `REDIS_HOST` - Redis hostname
- `REDIS_PORT` - Redis port
- `REDIS_PASSWORD` - Redis password, if any
- `ZICB_BANK_API_URL` - Bank API endpoint for ZICB submissions
- `ZICB_SOURCE_ACCOUNT` - Default source account for ZICB payments
- `ZICB_SOURCE_BRANCH` - Default source branch for ZICB payments
- `ZICB_USER_NAME` - Default username for ZICB payloads
- `ZICB_CUSTOMER_ID` - Default customer ID for ZICB payloads
- `ZICB_IP_ADDRESS` - Default IP address for ZICB payloads
- `JOB_ATTEMPTS` - Number of BullMQ retry attempts
- `JOB_BACKOFF_MS` - Retry backoff interval in milliseconds
