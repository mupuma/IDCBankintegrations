import { NextRequest, NextResponse } from 'next/server';
import { reportBankQueueResult } from '@/app/lib/agentQueue';

const BANK_PULL_API_KEY = process.env.BANK_PULL_API_KEY || null;
const STATUSES = new Set(['queued', 'processing', 'success', 'failed']);

export async function POST(request: NextRequest) {
  const providedApiKey = request.headers.get('x-bank-api-key');
  if (!BANK_PULL_API_KEY || providedApiKey !== BANK_PULL_API_KEY) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const queueId = String(body?.queueId ?? '');
  const status = String(body?.status ?? '').toLowerCase();

  if (!queueId) {
    return NextResponse.json({ success: false, error: 'queueId is required' }, { status: 400 });
  }

  if (!STATUSES.has(status)) {
    return NextResponse.json({ success: false, error: 'Invalid status value' }, { status: 400 });
  }

  const updated = await reportBankQueueResult(queueId, {
    status: status as 'queued' | 'processing' | 'success' | 'failed',
    response: body?.response,
    error: body?.error ? String(body.error) : undefined,
    agentId: body?.agentId ? String(body.agentId) : undefined,
    attempts: typeof body?.attempts === 'number' ? body.attempts : undefined,
  });

  if (!updated) {
    return NextResponse.json({ success: false, error: 'Queue item not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, queueId });
}
