import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { PaymentsResponse, BankCode } from '../../../models/dtos';
import { BANK_CODES } from '../../../lib/banks';
import { isAuthError, requirePermission } from '../../../lib/rbac';
import { PERMISSIONS } from '../../../lib/permissions';
import { logAuditEvent } from '../../../lib/auditLog';
import { enqueuePayment, getQueueItem, getAllQueueItems, getQueueItemsByBank, ensureQueueItemProcessing, type BankQueueItem } from '../../../lib/bankQueue';
import { connectDatabase } from '../../../lib/db';
import { PaymentQueueRequest } from '../../../models/internal/PaymentQueueRequest';
import { resolveSourceBank } from '../../../lib/banks/zicb';
import { IzbPayment } from '../../../models/internal/IzbPayment';
import { buildAlreadyPostedMessage, findExistingPaymentPost, resolvePaymentId } from '../../../lib/paymentPostGuard';
import { buildZicbPayload, validateZicbPayload } from '../../../lib/banks/payloadBuilders';

const BANK_PULL_API_KEY = process.env.BANK_PULL_API_KEY || null;

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, PERMISSIONS.PAYMENTS_POST);
  if (isAuthError(auth)) return auth;

  const body = await request.json();
  const bankCode = String(body?.bankCode ?? '').toUpperCase() as BankCode;
  const payment = body?.payment as PaymentsResponse | undefined;
  const sourceBankCode = body?.sourceBank ? String(body.sourceBank).trim() : null;

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

  // FIX: ZICB source bank validation with TRIM
  if (bankCode === 'ZICB') {
    console.log(`🔴 ZICB validation for sourceBank: ${sourceBankCode}`);

    // Check 1: sourceBank must exist
    if (!sourceBankCode) {
      console.error('❌ ZICB payment REJECTED: sourceBank missing');
      return NextResponse.json(
        { 
          success: false, 
          error: 'sourceBank is REQUIRED for ZICB payments. Please provide a valid source bank code.'
        },
        { status: 400 },
      );
    }

    try {
      const source = await resolveSourceBank(sourceBankCode);
      console.log(`Source bank resolved:`, source);

      // Check 2: source must exist (not null)
      if (!source) {
        console.error(`❌ ZICB payment REJECTED: source bank "${sourceBankCode}" not found`);
        return NextResponse.json(
          { 
            success: false, 
            error: `Payment CANNOT be posted: Source bank "${sourceBankCode}" not found in system.`,
            sourceBankCode
          },
          { status: 404 },
        );
      }

      // --- FIX: TRIM ALL VALUES ---
      const srcAcc = source.accountNumber?.toString().trim() || '';
      const srcBranch = source.transit?.toString().trim() || '';
      const srcName = source.name?.toString().trim() || '';

      console.log(`Trimmed values:`, { srcAcc, srcBranch, srcName });

      // Check 3: srcAcc must not be empty after trimming
      if (!srcAcc || srcAcc.length === 0) {
        console.error(`❌ ZICB payment REJECTED: source bank "${sourceBankCode}" has empty account number`);
        return NextResponse.json(
          { 
            success: false, 
            error: `Payment CANNOT be posted: Source bank "${sourceBankCode}" has no valid account number. Please update the source bank details.`,
            sourceBankCode,
            providedValues: {
              accountNumber: source.accountNumber,
              transit: source.transit,
              name: source.name
            }
          },
          { status: 400 },
        );
      }

      // Check 4: srcBranch must not be empty after trimming
      if (!srcBranch || srcBranch.length === 0) {
        console.error(`❌ ZICB payment REJECTED: source bank "${sourceBankCode}" has empty branch/transit code`);
        return NextResponse.json(
          { 
            success: false, 
            error: `Payment CANNOT be posted: Source bank "${sourceBankCode}" has no valid branch/transit code. Please update the source bank details.`,
            sourceBankCode,
            providedValues: {
              accountNumber: source.accountNumber,
              transit: source.transit,
              name: source.name
            }
          },
          { status: 400 },
        );
      }

      // All checks passed - populate payment with TRIMMED values
      console.log(`✅ Source bank validated. Populating payment with:`, {
        srcAcc,
        srcBranch,
        srcName
      });

      // Set the trimmed values (OVERWRITE, don't just set if empty)
      (payment as any).srcAcc = srcAcc;
      (payment as any).srcBranch = srcBranch;
      (payment as any).srcName = srcName || 'ZICB';

      const zicbPayload = buildZicbPayload(payment, payment.transactionType, source);
      const validationErrors = validateZicbPayload(zicbPayload);
      if (validationErrors.length) {
        return NextResponse.json(
          { success: false, error: 'Invalid ZICB transfer', validationErrors },
          { status: 400 },
        );
      }

      console.log('✅ ZICB validation PASSED. Payment enriched with source bank details.');

    } catch (err) {
      console.error('💥 Error resolving source bank:', err);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Internal error while resolving source bank details. Payment cannot be posted.'
        },
        { status: 500 },
      );
    }
  }

  // ... rest of your code continues here ...
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

  const paymentRef =
    (payment as { paymentId?: string; transactionReference?: string; vendorName?: string }).paymentId ||
    (payment as { transactionReference?: string }).transactionReference ||
    paymentId;

  await logAuditEvent({
    userId: auth.id,
    username: auth.username,
    action: 'PAYMENT_POSTED',
    resourceType: 'payment',
    resourceId: paymentId,
    summary: `${auth.username} posted payment ${paymentRef} to ${bankCode}`,
    details: {
      queueId,
      paymentId,
      bankCode,
      sourceBank: body?.sourceBank ?? null,
      vendorName: (payment as { vendorName?: string }).vendorName ?? null,
      amount: (payment as { amount?: number | string }).amount ?? null,
    },
    request,
  });

  // If this is a successful call to enqueue a payment, also create a cashbook record
  // in the central portal database for later processing by the Sage connector.
  // We'll insert a simple cashbook task into the DB if payment looks like a receipt.
  try {
    const isReceipt = (payment?.transactionType || '').toLowerCase().includes('rec') || 
                      (payment?.transactionReference || '').toLowerCase().includes('receipt') || false;
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
  } else if (sessionToken) {
    const auth = await requirePermission(request, PERMISSIONS.PAYMENTS_READ);
    if (isAuthError(auth)) return auth;
  } else if (!sessionToken && !bankCode) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
