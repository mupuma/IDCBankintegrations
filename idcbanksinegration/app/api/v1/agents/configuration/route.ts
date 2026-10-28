import { NextRequest, NextResponse } from 'next/server';
import { deliverAgentConfiguration } from '@/app/lib/agentOnboarding';
import { BankRegistryError } from '@/app/lib/bankRegistry';

export async function GET(request: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' };
  const forwardedTls = process.env.BANK_AGENT_TRUST_PROXY === 'true' && request.headers.get('x-forwarded-proto') === 'https';
  const localTest = process.env.BANK_AGENT_ALLOW_LOOPBACK_HTTP === 'true' && ['localhost', '127.0.0.1', '[::1]'].includes(request.nextUrl.hostname);
  if (request.nextUrl.protocol !== 'https:' && !forwardedTls && !localTest) return NextResponse.json({ error: 'HTTPS is required for agent configuration.' }, { status: 403, headers });
  try {
    const token = request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{32,256})$/)?.[1];
    const bankCode = request.headers.get('x-bank-code') || '';
    if (!token || !/^[A-Z][A-Z0-9_]{1,19}$/.test(bankCode)) throw new BankRegistryError('Invalid agent credentials.', 401);
    return NextResponse.json(await deliverAgentConfiguration(bankCode, token), { headers });
  } catch (error) {
    const status = error instanceof BankRegistryError ? error.status : 503;
    return NextResponse.json({ error: status === 401 ? 'Invalid agent credentials.' : status === 409 ? 'Agent configuration has not been saved.' : 'Agent configuration unavailable.' }, { status, headers });
  }
}
