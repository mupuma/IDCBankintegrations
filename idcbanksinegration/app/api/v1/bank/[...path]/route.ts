import { NextRequest, NextResponse } from 'next/server';
import { receiveH2hCallback, LedgerError } from '@/app/lib/zicb/ledger';
import { issueCallbackToken, validCallbackToken, sameSecret } from '@/app/lib/zicb/security';
import type { Channel } from '../../../../../../shared/zicb-h2h';

export async function POST(request: NextRequest) {
  const routes: Array<{ path: string; channel: Channel; auth: boolean }> = [
    { path: '/api/v1/bank/other-bank-rtgs-ft/auth/token', channel: 'RTGS', auth: true },
    { path: '/api/v1/bank/other-bank-rtgs-ft/callback', channel: 'RTGS', auth: false },
    { path: '/api/v1/bank/other-bank-ddacc-ft/auth/token', channel: 'DDACC', auth: true },
    { path: '/api/v1/bank/other-bank-ddacc-ft/callback', channel: 'DDACC', auth: false },
  ];
  // The exact Internal FT paths are explicitly unconfirmed in section 4.4.
  for (const [key, auth] of [['ZICB_H2H_INTERNAL_AUTH_PATH', true], ['ZICB_H2H_INTERNAL_CALLBACK_PATH', false]] as const) {
    const path = process.env[key];
    if (path?.startsWith('/api/v1/bank/') && !routes.some(route => route.path === path)) routes.push({ path, channel: 'INTERNAL', auth });
  }
  const route = routes.find(item => item.path === request.nextUrl.pathname);
  if (!route) return NextResponse.json({ error: 'Unknown callback path' }, { status: 404 });
  const body = await request.json().catch(() => null);
  if (route.auth) {
    if (!sameSecret(String(body?.username || ''), process.env.ZICB_H2H_WEBHOOK_USERNAME || '') || !sameSecret(String(body?.password || ''), process.env.ZICB_H2H_WEBHOOK_PASSWORD || '')) {
      return NextResponse.json({ error: 'unauthorized', message: 'Invalid credentials' }, { status: 401 });
    }
    try { return NextResponse.json({ token: issueCallbackToken(route.channel) }); }
    catch { return NextResponse.json({ error: 'Callback authentication is not configured' }, { status: 503 }); }
  }
  if (!validCallbackToken(request.headers.get('authorization'), route.channel)) return NextResponse.json({ error: 'unauthorized', message: 'Missing or invalid Authorization header' }, { status: 401 });
  try {
    await receiveH2hCallback(route.channel, body);
    return NextResponse.json({ status_code: 200, message: 'success' });
  } catch (error) {
    const status = error instanceof LedgerError ? error.status : 503;
    return NextResponse.json({ error: status === 409 ? 'duplicate_reference' : status === 400 ? 'validation_error' : 'callback_error', message: error instanceof LedgerError ? error.message : 'Unable to record callback' }, { status });
  }
}
