// Reference onboarding agent only; no payment submission or cashbook posting.
const http = require('node:http');
const { manifestHandler, fetchConfiguration } = require('../../shared/bank-agent-v1/runtime.cjs');
const bankCode = process.env.BANK_CODE || 'DEMO';
const token = process.env.BANK_AGENT_TOKEN;
const manifest = {
  protocol: 'bank-agent/v1', bankCode, displayName: 'Example bank', agentVersion: '0.1.0',
  transactionTypes: ['RTGS'], operations: ['validate'],
  configuration: [
    { key: 'BANK_API_URL', label: 'Bank API URL', type: 'url', required: true },
    { key: 'CLIENT_ID', label: 'Client ID', type: 'string', required: true },
    { key: 'CLIENT_SECRET', label: 'Client secret', type: 'secret', required: true },
  ],
};
http.createServer(manifestHandler({ manifest, token })).listen(Number(process.env.PORT || 4010), '127.0.0.1', () => console.log('Reference agent listening on loopback; use a TLS proxy for deployment.'));
if (process.env.PORTAL_URL) {
  // Retrieve on demand or restart after saving settings. Never print configuration values.
  fetchConfiguration({ portalUrl: process.env.PORTAL_URL, bankCode, token, allowLoopbackHttp: process.env.ALLOW_LOOPBACK_HTTP === 'true' })
    .then(value => console.log(`Configuration received for ${value.bankCode}, revision ${value.revision}.`))
    .catch(() => console.error('Configuration not yet available; save it in the portal and restart the reference agent.'));
}
