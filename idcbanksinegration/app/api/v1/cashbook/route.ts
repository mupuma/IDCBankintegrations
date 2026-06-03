import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { connectDatabase } from '../../../lib/db';
import CashbookRequest from '../../../models/internal/CashbookRequest';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const transactionId = String(body?.transactionId ?? '').trim();

  if (!transactionId) {
    return NextResponse.json({ responseCode: 400, responseMessage: 'transactionId is required' }, { status: 400 });
  }

  await connectDatabase();

  // Idempotency: if transactionId already exists, return ok with existing status
  const existing = await CashbookRequest.findOne({ where: { transactionId } });
  if (existing) {
    return NextResponse.json({ responseCode: 200, responseMessage: 'already queued', id: existing.id });
  }

  try {
    const record = await CashbookRequest.create({
      transactionId,
      payload: JSON.stringify(body),
      status: 'queued',
      attempts: 0,
    });

    return NextResponse.json({ responseCode: 200, responseMessage: 'queued', id: record.id });
  } catch (err) {
    console.error('Failed to create cashbook request', err);
    return NextResponse.json({ responseCode: 500, responseMessage: 'failed to queue request' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const transactionId = request.nextUrl.searchParams.get('transactionId');
  if (!transactionId) return NextResponse.json({ success: false, error: 'transactionId required' }, { status: 400 });

  await connectDatabase();
  const existing = await CashbookRequest.findOne({ where: { transactionId } });
  if (!existing) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 });
  return NextResponse.json({ success: true, item: existing });
}
