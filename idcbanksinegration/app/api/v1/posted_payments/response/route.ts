import { NextRequest, NextResponse } from 'next/server';
import { connectDatabase } from '@/app/lib/db';
import { updateQueueItemStatus } from '@/app/lib/bankQueue';

export async function POST(request: NextRequest) {
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

  const item = await updateQueueItemStatus(queueId, {
    status: status as 'queued' | 'processing' | 'success' | 'failed',
    response,
    lastError: error,
    attempts,
  });

  if (!item) {
    return NextResponse.json({ success: false, error: 'Queue item not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, queueId });
}
