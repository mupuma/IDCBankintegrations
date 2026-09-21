import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Channel } from '../../../shared/zicb-h2h';
import { callbackErrors } from '../../../shared/zicb-h2h';
import type { WorkPortal } from './h2hRunner';

type CallbackRoute = { path: string; channel: Channel; auth: boolean };

function sameSecret(a: string, b: string) {
  if (!a || !b) return false;
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function signingKey() {
  const key = process.env.ZICB_H2H_WEBHOOK_SIGNING_KEY || '';
  if (key.length < 32) throw new Error('Configure ZICB_H2H_WEBHOOK_SIGNING_KEY with at least 32 characters');
  return key;
}

function issueCallbackToken(channel: Channel) {
  const payload = Buffer.from(JSON.stringify({ channel, exp: Math.floor(Date.now() / 1000) + 300, jti: randomUUID() })).toString('base64url');
  return `${payload}.${createHmac('sha256', signingKey()).update(payload).digest('base64url')}`;
}

function validCallbackToken(authorization: string | undefined, channel: Channel) {
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

export function callbackRoutes(): CallbackRoute[] {
  const routes: CallbackRoute[] = [
    { path: '/api/v1/bank/other-bank-rtgs-ft/auth/token', channel: 'RTGS', auth: true },
    { path: '/api/v1/bank/other-bank-rtgs-ft/callback', channel: 'RTGS', auth: false },
    { path: '/api/v1/bank/other-bank-ddacc-ft/auth/token', channel: 'DDACC', auth: true },
    { path: '/api/v1/bank/other-bank-ddacc-ft/callback', channel: 'DDACC', auth: false },
  ];
  for (const [key, auth] of [['ZICB_H2H_INTERNAL_AUTH_PATH', true], ['ZICB_H2H_INTERNAL_CALLBACK_PATH', false]] as const) {
    const path = process.env[key];
    if (path?.startsWith('/api/v1/bank/') && !routes.some(route => route.path === path)) routes.push({ path, channel: 'INTERNAL', auth });
  }
  return routes;
}

export async function handleBankCallback(route: CallbackRoute, headers: Record<string, string | string[] | undefined>, body: unknown, portal: Pick<WorkPortal, 'callback'>) {
  if (route.auth) {
    const credentials = body as { username?: unknown; password?: unknown } | null;
    if (!sameSecret(String(credentials?.username || ''), process.env.ZICB_H2H_WEBHOOK_USERNAME || '')
      || !sameSecret(String(credentials?.password || ''), process.env.ZICB_H2H_WEBHOOK_PASSWORD || '')) {
      return { status: 401, body: { error: 'unauthorized', message: 'Invalid credentials' } };
    }
    try { return { status: 200, body: { token: issueCallbackToken(route.channel) } }; }
    catch { return { status: 503, body: { error: 'Callback authentication is not configured' } }; }
  }

  const authorization = Array.isArray(headers.authorization) ? headers.authorization[0] : headers.authorization;
  if (!validCallbackToken(authorization, route.channel)) return { status: 401, body: { error: 'unauthorized', message: 'Missing or invalid Authorization header' } };
  const errors = callbackErrors(body);
  if (errors.length) return { status: 400, body: { error: 'validation_error', message: errors.join('; ') } };

  try {
    await portal.callback(route.channel, body);
    return { status: 200, body: { status_code: 200, message: 'success' } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to record callback';
    const duplicate = /HTTP 409/.test(message);
    return { status: duplicate ? 409 : 503, body: { error: duplicate ? 'duplicate_reference' : 'callback_error', message } };
  }
}
