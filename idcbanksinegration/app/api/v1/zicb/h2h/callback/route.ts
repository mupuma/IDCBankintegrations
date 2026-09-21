import { NextRequest, NextResponse } from 'next/server';
import { receiveH2hCallback, LedgerError } from '@/app/lib/zicb/ledger';
import { isAgent } from '@/app/lib/zicb/security';
import type { Channel } from '../../../../../../../shared/zicb-h2h';

const channels = new Set<Channel>(['INTERNAL', 'RTGS', 'DDACC']);

export async function POST(request: NextRequest) {
  if (!isAgent(request.headers)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await request.json().catch(() => null);
  const channel = payload?.channel as Channel | undefined;
  if (!channel || !channels.has(channel) || !payload?.body) {
    return NextResponse.json({ error: 'channel and body are required' }, { status: 400 });
  }
  try {
    await receiveH2hCallback(channel, payload.body);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof LedgerError ? error.message : 'Unable to record callback' }, { status: error instanceof LedgerError ? error.status : 503 });
  }
}
