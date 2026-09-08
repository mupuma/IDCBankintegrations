import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export function sameSecret(a: string, b: string) {
  if (!a || !b) return false;
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function isAgent(headers: Headers) {
  return sameSecret(headers.get('x-zicb-agent-key') || '', process.env.ZICB_H2H_AGENT_KEY || '');
}
function signingKey() {
  const key = process.env.ZICB_H2H_WEBHOOK_SIGNING_KEY || '';
  if (key.length < 32) throw new Error('Configure a webhook signing key of at least 32 characters');
  return key;
}
export function issueCallbackToken(channel: string) {
  const payload = Buffer.from(JSON.stringify({ channel, exp: Math.floor(Date.now() / 1000) + 300, jti: randomUUID() })).toString('base64url');
  return `${payload}.${createHmac('sha256', signingKey()).update(payload).digest('base64url')}`;
}
export function validCallbackToken(authorization: string | null, channel: string) {
  try {
    if (!authorization?.startsWith('Bearer ')) return false;
    const parts = authorization.slice(7).split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
    const expected = createHmac('sha256', signingKey()).update(parts[0]).digest('base64url');
    if (!sameSecret(parts[1], expected)) return false;
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    return payload.channel === channel && Number.isInteger(payload.exp) && payload.exp > Date.now() / 1000;
  } catch { return false; }
}
