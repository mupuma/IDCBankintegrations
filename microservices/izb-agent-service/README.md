# IZB Agent Service

This service proxies IZB payment pulls and final bank responses to the portal.
Copy [`.env.example`](.env.example) to `.env` and configure the portal URL,
portal key and separate bank-facing key.

See the [three-bank deployment guide](../../idcbanksinegration/docs/bank-environment-deployment.md)
for matching settings, startup commands and verification. Start the service from
this directory with `npm ci`, `npm run build`, then `npm start`.

The active proxy uses no Redis or Sage credentials. Bank outcomes remain local
in the portal; a successful final bank response must contain its bank reference.
