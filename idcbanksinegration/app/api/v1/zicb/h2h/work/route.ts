import { NextRequest, NextResponse } from 'next/server';
import { claimH2hWork, reportH2hWork, LedgerError } from '@/app/lib/zicb/ledger';
import { isAgent } from '@/app/lib/zicb/security';
import { h2hEnabled } from '@/app/lib/zicb/config';

export async function POST(request: NextRequest) {
  if (!isAgent(request.headers)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!h2hEnabled()) return NextResponse.json({ error: 'H2H is not enabled' }, { status: 503 });
  try { return NextResponse.json({ item: await claimH2hWork() }); }
  catch (error) {
    console.error('H2H work claim failed', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'Unable to claim H2H work' }, { status: 503 });
  }
}
export async function PATCH(request: NextRequest) {
  if (!isAgent(request.headers)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body?.queueId || !body?.leaseToken || !body?.outcome) return NextResponse.json({ error: 'queueId, leaseToken and outcome are required' }, { status: 400 });
  try {
    await reportH2hWork(body.queueId, body.leaseToken, body.outcome);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof LedgerError ? error.message : 'Unable to record H2H result' }, { status: error instanceof LedgerError ? error.status : 503 });
  }
}
