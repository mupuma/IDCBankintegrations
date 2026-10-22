import { NextRequest, NextResponse } from 'next/server';
import { claimH2hWork, reportH2hWork, LedgerError } from '@/app/lib/zicb/ledger';
import { isAgent } from '@/app/lib/zicb/security';
import { terminalError, terminalLog } from '@/app/lib/terminalLog';

export async function POST(request: NextRequest) {
  if (!isAgent(request.headers)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const item = await claimH2hWork();
    terminalLog('zicb.h2h.work.claimed', {
      queueId: item?.queueId,
      action: item?.action,
      channel: item?.channel,
      profileId: item?.profileId,
      hasWork: Boolean(item),
    });
    return NextResponse.json({ item });
  }
  catch (error) {
    terminalError('zicb.h2h.work.claim_failed', {
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to claim H2H work' }, { status: 503 });
  }
}
export async function PATCH(request: NextRequest) {
  if (!isAgent(request.headers)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body?.queueId || !body?.leaseToken || !body?.outcome) return NextResponse.json({ error: 'queueId, leaseToken and outcome are required' }, { status: 400 });
  try {
    await reportH2hWork(body.queueId, body.leaseToken, body.outcome);
    terminalLog('zicb.h2h.work.reported', {
      queueId: body.queueId,
      outcome: body.outcome?.state,
      bankRef: body.outcome?.bankRef,
      error: body.outcome?.error,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    terminalError('zicb.h2h.work.report_failed', {
      queueId: body.queueId,
      outcome: body.outcome?.state,
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return NextResponse.json({ error: error instanceof LedgerError ? error.message : 'Unable to record H2H result' }, { status: error instanceof LedgerError ? error.status : 503 });
  }
}
