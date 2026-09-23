# ZICB H2H Agent Service

This service runs only the ZICB H2H v1 protocol. The legacy BullMQ/API sender has been removed and `/payments` is no longer a submission path.

Payments must be submitted through the portal, which stores them in the durable H2H ledger. The agent claims work from the portal and sends it through the configured H2H channels.

## Run

```bash
cd microservices/zicb-agent-service
npm install
npm run dev
```

Required environment:

- `ZICB_H2H_ENABLED=true`
- `ZICB_H2H_PROFILES`
- `ZICB_H2H_AGENT_KEY`
- `APP_API_URL`

## Verification

```bash
npm test
npm run build
```

## Notes

- `npm run dev:api` and `npm run dev:worker` intentionally fail because the legacy sender is disabled.
- `POST /payments` returns `410 Gone`; use the portal H2H ledger instead.
- The Docker build context is the repository root because the service imports `shared/zicb-h2h`.

```powershell
docker build -f microservices/zicb-agent-service/Dockerfile -t zicb-agent .
```
