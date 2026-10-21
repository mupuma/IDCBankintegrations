import { NextRequest, NextResponse } from 'next/server';
import { sameSecret } from '@/app/lib/zicb/security';
import { claimZanacoRecovery, reportZanacoRecovery, RecoveryError } from '@/app/lib/paymentRecovery';

function authorised(request: NextRequest) {
  return sameSecret(request.headers.get('x-bank-api-key') || '', process.env.BANK_PULL_API_KEY || '');
}
export async function POST(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { return NextResponse.json({ item: await claimZanacoRecovery() }); }
  catch { return NextResponse.json({ error: 'Recovery claim unavailable' }, { status: 503 }); }
}
export async function PATCH(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.actionId !== 'string' || typeof body.leaseToken !== 'string'
    || typeof body.success !== 'boolean' || typeof body.message !== 'string') return NextResponse.json({ error: 'Invalid recovery report' }, { status: 400 });
  try {
    await reportZanacoRecovery(body.actionId, body.leaseToken, body.success, body.message);
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Recovery report unavailable' }, { status: error instanceof RecoveryError ? error.status : 503 }); }
}
