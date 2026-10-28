/** Dependency-free reference transport. This module never submits bank payments. */
const { createHash, timingSafeEqual } = require('node:crypto');
const hash = value => createHash('sha256').update(value).digest();
function manifestHandler({ manifest, token }) {
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(token || '')) throw new Error('A dedicated agent token is required');
  return (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json');
    const supplied = request.headers.authorization || '';
    if (!timingSafeEqual(hash(supplied), hash(`Bearer ${token}`))) {
      response.writeHead(401); response.end('{"error":"unauthorized"}'); return;
    }
    if (request.method !== 'GET' || request.url !== '/v1/manifest') {
      response.writeHead(404); response.end('{"error":"not_found"}'); return;
    }
    response.writeHead(200); response.end(JSON.stringify(manifest));
  };
}
async function fetchConfiguration({ portalUrl, bankCode, token, allowLoopbackHttp = false }) {
  const url = new URL(portalUrl);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
    (url.protocol !== 'https:' && !(allowLoopbackHttp && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error('Portal URL must be an HTTPS origin');
  const response = await fetch(`${url.origin}/api/v1/agents/configuration`, {
    headers: { Authorization: `Bearer ${token}`, 'x-bank-code': bankCode }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Portal configuration request failed (${response.status})`);
  const value = await response.json();
  if (value.protocol !== 'bank-agent/v1' || value.bankCode !== bankCode || !Number.isSafeInteger(value.revision) || !value.configuration || typeof value.configuration !== 'object' || Array.isArray(value.configuration)) throw new Error('Invalid portal configuration response');
  return value;
}
module.exports = { manifestHandler, fetchConfiguration };
