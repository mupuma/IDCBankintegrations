# ZICB Agent Service

The ZICB agent service runs the PayBill H2H v1 integration only.

Payments are submitted through the portal's ZICB H2H ledger. The agent:

- claims H2H work from the portal
- sends payment submissions to ZICB
- reconciles submitted references when required
- receives ZICB callbacks
- forwards callbacks to the portal
- triggers accounting recovery when a payment is confirmed paid

There is no bank-facing `/payments` route in this service.

## Run

```bash
cd microservices/zicb-agent-service
npm install
npm run build
npm start
```

For development:

```bash
npm run dev
```

## Docker

The Docker build context is the repository root because the service uses
`shared/zicb-h2h`:

```powershell
docker build -f microservices/zicb-agent-service/Dockerfile -t zicb-agent .
```

## Public Agent Endpoints

These are the endpoints ZICB calls on the agent.

```text
GET  /health

POST /api/v1/bank/internal-ft/auth/token
POST /api/v1/bank/internal-ft/callback

POST /api/v1/bank/other-bank-rtgs-ft/auth/token
POST /api/v1/bank/other-bank-rtgs-ft/callback

POST /api/v1/bank/other-bank-ddacc-ft/auth/token
POST /api/v1/bank/other-bank-ddacc-ft/callback
```

## Required Environment

```text
PORT=4001
APP_API_URL=https://<portal-host>
ZICB_H2H_AGENT_KEY=<shared-agent-key>
ZICB_H2H_WEBHOOK_USERNAME=<callback-username>
ZICB_H2H_WEBHOOK_PASSWORD=<callback-password>
ZICB_H2H_WEBHOOK_SIGNING_KEY=<at-least-32-characters>
ZICB_H2H_PROFILES=<json-profile-map>
```

`ZICB_H2H_PROFILES` must provide the ZICB client credentials and base URLs for
each approved profile.

## Contract

Share the API contract with ZICB from:

[ZICB_H2H_API_DOCUMENTATION.md](./ZICB_H2H_API_DOCUMENTATION.md)
