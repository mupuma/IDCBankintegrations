import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { PaymentsResponse, BankCode } from '../../../models/dtos';
import { BANK_CODES } from '../../../lib/banks';
import { verifySessionToken } from '../../auth/login/middleware/auth';
import { enqueuePayment, getQueueItem, getAllQueueItems, getQueueItemsByBank, ensureQueueItemProcessing } from '../../../lib/bankQueue';
import { connectDatabase } from '../../../lib/db';
import { PaymentQueueRequest } from '../../../models/internal/PaymentQueueRequest';
import { buildAlreadyPostedMessage, findExistingPaymentPost, resolvePaymentId } from '../../../lib/paymentPostGuard';

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get('session')?.value;
  const user = await verifySessionToken(sessionToken);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const bankCode = String(body?.bankCode ?? '').toUpperCase() as BankCode;
  const payment = body?.payment as PaymentsResponse | undefined;

  if (!BANK_CODES.includes(bankCode)) {
    return NextResponse.json(
      { success: false, error: `bankCode must be one of ${BANK_CODES.join(', ')}` },
      { status: 400 },
    );
  }

  if (!payment || typeof payment !== 'object') {
    return NextResponse.json(
      { success: false, error: 'payment payload is required and must be an object' },
      { status: 400 },
    );
  }

  const queueId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const paymentId = resolvePaymentId(payment as { paymentId?: string }, queueId);

  await connectDatabase();

  const existingPost = await findExistingPaymentPost(paymentId);
  if (existingPost) {
    return NextResponse.json(
      {
        success: false,
        alreadyPosted: true,
        error: buildAlreadyPostedMessage(existingPost, bankCode),
        paymentId,
        bankCode,
        postedBankCode: existingPost.bankCode,
        existingStatus: existingPost.status,
        queueId: existingPost.queueId,
      },
      { status: 409 },
    );
  }

  await PaymentQueueRequest.create({
    queueId,
    paymentId,
    bankCode,
    paymentPayload: JSON.stringify(payment),
    status: 'queued',
    attempts: 0,
  });

  const queueItem = enqueuePayment(bankCode, payment, queueId);
  void ensureQueueItemProcessing(queueItem.id);

  return NextResponse.json({
    success: true,
    queueId: queueItem.id,
    status: queueItem.status,
    item: queueItem,
  });
}

export async function GET(request: NextRequest) {
  const queueId = request.nextUrl.searchParams.get('queueId');
  const bankCode = request.nextUrl.searchParams.get('bankCode') as BankCode | null;

  if (queueId) {
    const queueItem = getQueueItem(queueId);
    if (!queueItem) {
      return NextResponse.json({ success: false, error: 'Queue item not found' }, { status: 404 });
    }

    await ensureQueueItemProcessing(queueId);
    return NextResponse.json({ success: true, item: queueItem });
  }

  if (bankCode && !BANK_CODES.includes(bankCode)) {
    return NextResponse.json(
      { success: false, error: `bankCode must be one of ${BANK_CODES.join(', ')}` },
      { status: 400 },
    );
  }

  const items = bankCode ? getQueueItemsByBank(bankCode) : getAllQueueItems();
  return NextResponse.json({ success: true, items });
}
