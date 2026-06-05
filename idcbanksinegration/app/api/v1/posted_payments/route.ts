import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { PaymentsResponse, BankCode } from '../../../models/dtos';
import { BANK_CODES } from '../../../lib/banks';
import { verifySessionToken } from '../../auth/login/middleware/auth';
import { enqueuePayment, getQueueItem, getAllQueueItems, getQueueItemsByBank, ensureQueueItemProcessing, type BankQueueItem } from '../../../lib/bankQueue';
import { connectDatabase } from '../../../lib/db';
import { PaymentQueueRequest } from '../../../models/internal/PaymentQueueRequest';
import { IzbPayment } from '../../../models/internal/IzbPayment';
import { buildAlreadyPostedMessage, findExistingPaymentPost, resolvePaymentId } from '../../../lib/paymentPostGuard';

const BANK_PULL_API_KEY = process.env.BANK_PULL_API_KEY || null;

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
    sourceBank: String(body?.sourceBank ?? null),
    paymentPayload: JSON.stringify(payment),
    status: 'queued',
    attempts: 0,
  });

  // If the payment is intended for IZB, also insert into the intermediary izB pending table
  try {
    if (bankCode === 'IZB') {
      const paymentDateStr = (payment as any)?.transactionDate || (payment as any)?.paymentDate || null;
      const paymentDate = paymentDateStr ? new Date(paymentDateStr) : null;
      await IzbPayment.create({
        paymentId,
        paymentDate,
        sourceBank: String(body?.sourceBank ?? 'IZB'),
        paymentPayload: JSON.stringify(payment),
        status: 'queued',
        attempts: 0,
      });
    }
  } catch (err) {
    console.error('Failed to insert IZB intermediary record', err);
  }

  const queueItem = enqueuePayment(bankCode, payment, queueId, String(body?.sourceBank ?? null));
  void ensureQueueItemProcessing(queueItem.id);

  // If this is a successful call to enqueue a payment, also create a cashbook record
  // in the central portal database for later processing by the Sage connector.
  // We'll insert a simple cashbook task into the DB if payment looks like a receipt.
  try {
    const isReceipt = (payment?.transactionType || '').toLowerCase().includes('rec') || (payment?.transactionReference || '').toLowerCase().includes('receipt') || false;
    if (isReceipt) {
      await PaymentQueueRequest.create({
        queueId: `${queueId}-cb`,
        paymentId: String((payment as any).paymentId || `${queueId}-cb`),
        bankCode,
        sourceBank: String(body?.sourceBank ?? null),
        paymentPayload: JSON.stringify({ type: 'cashbook', originalQueueId: queueId, payment }),
        status: 'queued',
        attempts: 0,
      });
    }
  } catch (err) {
    // don't fail enqueue if cashbook logging fails
    console.error('Failed to queue cashbook placeholder', err);
  }

  return NextResponse.json({
    success: true,
    queueId: queueItem.id,
    status: queueItem.status,
    item: queueItem,
  });
}

function mapQueueRecordToItem(record: PaymentQueueRequest): BankQueueItem | null {
  let payment: PaymentsResponse;
  try {
    payment = JSON.parse(record.paymentPayload) as PaymentsResponse;
  } catch {
    return null;
  }

  let response: unknown;
  if (record.responsePayload) {
    try {
      response = JSON.parse(record.responsePayload);
    } catch {
      response = record.responsePayload;
    }
  }

  return {
    id: record.queueId,
    paymentId: record.paymentId,
    bankCode: record.bankCode as BankCode,
    sourceBank: (record as any).sourceBank ?? null,
    payment,
    status: record.status as BankQueueItem['status'],
    attempts: record.attempts,
    lastError: record.lastError ?? undefined,
    response,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const queueId = request.nextUrl.searchParams.get('queueId');
  const bankCode = request.nextUrl.searchParams.get('bankCode') as BankCode | null;

  const sourceBank = request.nextUrl.searchParams.get('sourceBank') ?? null;

  if (bankCode && !BANK_CODES.includes(bankCode)) {
    return NextResponse.json(
      { success: false, error: `bankCode must be one of ${BANK_CODES.join(', ')}` },
      { status: 400 },
    );
  }

  const sessionToken = request.cookies.get('session')?.value;
  const providedApiKey = request.headers.get('x-bank-api-key');

  // If this is a bank pull (no user session but bankCode provided), require API key
  if (!sessionToken && bankCode) {
    if (!BANK_PULL_API_KEY || providedApiKey !== BANK_PULL_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  await connectDatabase();

  if (queueId) {
    const queueItem = getQueueItem(queueId);
    if (queueItem) {
      await ensureQueueItemProcessing(queueId);
      return NextResponse.json({ success: true, item: queueItem });
    }

    const record = await PaymentQueueRequest.findOne({ where: { queueId } });
    if (!record) {
      return NextResponse.json({ success: false, error: 'Queue item not found' }, { status: 404 });
    }

    const item = mapQueueRecordToItem(record);
    if (!item) {
      return NextResponse.json({ success: false, error: 'Invalid saved queue payload' }, { status: 500 });
    }

    return NextResponse.json({ success: true, item });
  }

  let memoryItems = bankCode ? getQueueItemsByBank(bankCode) : getAllQueueItems();
  if (sourceBank) {
    memoryItems = memoryItems.filter((i) => (i.sourceBank ?? null) === sourceBank);
  }

  const where: any = {};
  if (bankCode) where.bankCode = bankCode;
  if (sourceBank) where.sourceBank = sourceBank;

  const records = await PaymentQueueRequest.findAll(Object.keys(where).length ? { where } : {});
  const dbItems = records
    .map(mapQueueRecordToItem)
    .filter((item): item is BankQueueItem => item !== null);

  const mergedItems = [...memoryItems];
  const existingIds = new Set(memoryItems.map((item) => item.id));
  for (const item of dbItems) {
    if (!existingIds.has(item.id)) {
      mergedItems.push(item);
    }
  }

  // sort by updatedAt descending for sensible paging order
  mergedItems.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  // support optional pagination via `page` and `pageSize` query params
  const pageParam = request.nextUrl.searchParams.get('page');
  const pageSizeParam = request.nextUrl.searchParams.get('pageSize');

  if (pageParam) {
    const page = Math.max(1, parseInt(pageParam, 10) || 1);
    const pageSize = Math.max(1, Math.min(500, parseInt(pageSizeParam || '50', 10)));
    const total = mergedItems.length;
    const start = (page - 1) * pageSize;
    const items = mergedItems.slice(start, start + pageSize);

    return NextResponse.json({ success: true, items, total, page, pageSize });
  }

  return NextResponse.json({ success: true, items: mergedItems });
}
