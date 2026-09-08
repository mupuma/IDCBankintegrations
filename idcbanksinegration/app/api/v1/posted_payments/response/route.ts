import { NextRequest, NextResponse } from 'next/server';
import { connectDatabase } from '@/app/lib/db';
import { updateQueueItemStatus } from '@/app/lib/bankQueue';
import { reportBankQueueResult } from '@/app/lib/agentQueue';
import { sameSecret } from '@/app/lib/zicb/security';
import { PaymentQueueRequest } from '@/app/models/internal/PaymentQueueRequest';

export async function POST(request: NextRequest) {
  if (!sameSecret(request.headers.get('x-bank-api-key') || '', process.env.BANK_PULL_API_KEY || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json();
  const queueId = String(body?.queueId ?? '');
  const status = String(body?.status ?? '').toLowerCase();
  const response = body?.response;
  const error = body?.error ? String(body.error) : undefined;
  const attempts = typeof body?.attempts === 'number' ? body.attempts : undefined;

  if (!queueId) {
    return NextResponse.json({ success: false, error: 'queueId is required' }, { status: 400 });
  }

  if (!['queued', 'processing', 'success', 'failed'].includes(status)) {
    return NextResponse.json({ success: false, error: 'Invalid status value' }, { status: 400 });
  }

  await connectDatabase();
  const saved = await PaymentQueueRequest.findOne({ where: { queueId } });
  if (saved && JSON.parse(saved.paymentPayload)?.h2hProtocol === 'h2h-v1') {
    return NextResponse.json({ error: 'Use the H2H callback contract' }, { status: 409 });
  }

  const item = await updateQueueItemStatus(queueId, {
    status: status as 'queued' | 'processing' | 'success' | 'failed',
    response,
    lastError: error,
    attempts,
  });

  if (!item) {
    const updated = await reportBankQueueResult(queueId, {
      status: status as 'queued' | 'processing' | 'success' | 'failed',
      response,
      error,
      agentId: 'legacy-agent-callback',
    });

    if (updated) {
      return NextResponse.json({ success: true, queueId });
    }

    return NextResponse.json({ success: false, error: 'Queue item not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, queueId });
}
