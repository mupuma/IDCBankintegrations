import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { PaymentsResponse, BankCode } from '../../../models/dtos';
import { BANK_CODES } from '../../../lib/banks';
import { isAuthError, requirePermission } from '../../../lib/rbac';
import { PERMISSIONS } from '../../../lib/permissions';
import { logAuditEvent } from '../../../lib/auditLog';
import {
  enqueuePayment,
  getQueueItem,
  getAllQueueItems,
  getQueueItemsByBank,
  ensureQueueItemProcessing,
  isStaleProcessingRecord,
  rehydrateAndProcessQueueRecord,
  type BankQueueItem,
} from '../../../lib/bankQueue';
import { connectDatabase, getSequelize } from '../../../lib/db';
import { createHash } from 'node:crypto';
import { PaymentDispatchReservation } from '@/app/models/internal/ZicbH2hPayment';
import { PaymentQueueRequest } from '../../../models/internal/PaymentQueueRequest';
import { resolveSourceBank } from '../../../lib/banks/zicb';
import { IzbPayment } from '../../../models/internal/IzbPayment';
import { buildAlreadyPostedMessage, findExistingPaymentPost, resolvePaymentId } from '../../../lib/paymentPostGuard';
import { buildZanacoPayload, buildZicbPayload, validateZanacoPayload, validateZicbPayload } from '../../../lib/banks/payloadBuilders';
import { getBankIntegration } from '@/app/lib/bankIntegrations';
import { h2hEnabled } from '@/app/lib/zicb/config';
import { enqueueH2h, LedgerError } from '@/app/lib/zicb/ledger';
import { terminalLog, terminalError } from '@/app/lib/terminalLog';

const BANK_PULL_API_KEY = process.env.BANK_PULL_API_KEY || null;

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, PERMISSIONS.PAYMENTS_POST);
  if (isAuthError(auth)) return auth;

  const body = await request.json();
  const bankCode = String(body?.bankCode ?? '').toUpperCase() as BankCode;
  const payment = body?.payment as PaymentsResponse | undefined;
  const sourceBankCode = body?.sourceBank ? String(body.sourceBank).trim() : null;
  const payments = Array.isArray(body?.payments) ? body.payments as PaymentsResponse[] : null;
  const bulkTransactionType = body?.transactionType ? String(body.transactionType).toUpperCase() as PaymentsResponse['transactionType'] : undefined;

  terminalLog('posted_payments.request.received', {
    bankCode,
    sourceBank: sourceBankCode,
    bulk: Boolean(payments),
    paymentCount: payments?.length ?? (payment ? 1 : 0),
    transactionType: bulkTransactionType ?? payment?.transactionType,
    paymentId: payment?.paymentId,
  });

  if (!BANK_CODES.includes(bankCode)) {
    return NextResponse.json(
      { success: false, error: `bankCode must be one of ${BANK_CODES.join(', ')}` },
      { status: 400 },
    );
  }

  if (payments) {
    return postManyPayments({
      request,
      auth,
      bankCode,
      payments,
      sourceBankCode,
      transactionType: bulkTransactionType,
    });
  }

  if (!payment || typeof payment !== 'object') {
    return NextResponse.json(
      { success: false, error: 'payment payload is required and must be an object' },
      { status: 400 },
    );
  }

  let paymentToQueue = payment;

  if (bankCode === 'ZICB' && !h2hEnabled()) {
    return NextResponse.json(
      { success: false, error: 'ZICB legacy dispatch has been removed. Enable ZICB_H2H_ENABLED=true.' },
      { status: 503 },
    );
  }

  // ZICB must go through the durable H2H ledger. Never fall back to legacy BNK9900 dispatch.
  if (bankCode === 'ZICB' && h2hEnabled()) {
    if (!sourceBankCode) return NextResponse.json({ error: 'A source account is required' }, { status: 400 });
    try {
      const source = await resolveSourceBank(sourceBankCode);
      if (!source?.accountNumber || !source.transit) return NextResponse.json({ error: 'Source account details are incomplete' }, { status: 400 });
      const result = await enqueueH2h(payment, sourceBankCode);
      await logAuditEvent({ userId: auth.id, username: auth.username, action: 'PAYMENT_POSTED', resourceType: 'payment',
        resourceId: result.paymentId, correlationId: result.queueId, summary: `${auth.username} queued a ZICB H2H payment`,
        details: { reference: result.reference, prcn: result.prcn_number }, request });
      return NextResponse.json({ success: true, ...result, dispatchStrategy: 'h2h-ledger' }, { status: 202 });
    } catch (error) {
      return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to queue H2H payment' }, { status: error instanceof LedgerError ? error.status : 400 });
    }
  }

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

  if (bankCode === 'ZANACO') {
    const selectedTransactionType = String(payment.transactionType ?? '').toUpperCase() as PaymentsResponse['transactionType'];
    if (!['INT', 'RTGS', 'DDACCT', 'DDAC', 'TT', 'SWIFT'].includes(selectedTransactionType)) {
      return NextResponse.json(
        { success: false, error: 'transactionType must be one of INT, RTGS, DDACCT, DDAC, TT, SWIFT for Zanaco payments.' },
        { status: 400 },
      );
    }

    if (!sourceBankCode) {
      terminalError('posted_payments.zanaco.validation_failed', {
        paymentId: payment.paymentId,
        bankCode,
        error: 'sourceBank is REQUIRED for Zanaco payments because ZWS requires a debitAccount.',
      });
      return NextResponse.json(
        { success: false, error: 'sourceBank is REQUIRED for Zanaco payments because ZWS requires a debitAccount.' },
        { status: 400 },
      );
    }

    try {
      const source = await resolveSourceBank(sourceBankCode);
      if (!source?.accountNumber) {
        terminalError('posted_payments.zanaco.validation_failed', {
          paymentId: payment.paymentId,
          bankCode,
          sourceBank: sourceBankCode,
          error: `Source bank "${sourceBankCode}" has no valid account number.`,
        });
        return NextResponse.json(
          { success: false, error: `Payment CANNOT be posted: Source bank "${sourceBankCode}" has no valid account number.` },
          { status: 400 },
        );
      }

      paymentToQueue = {
        ...payment,
        transactionType: selectedTransactionType,
        srcAcc: source.accountNumber?.toString().trim() || '',
        srcBranch: source.transit?.toString().trim() || '',
        srcName: source.name?.toString().trim() || '',
      };

      const zanacoPayload = buildZanacoPayload(paymentToQueue, selectedTransactionType, source);
      const validationErrors = validateZanacoPayload(zanacoPayload);
      if (validationErrors.length) {
        terminalError('posted_payments.zanaco.validation_failed', {
          paymentId: payment.paymentId,
          bankCode,
          sourceBank: sourceBankCode,
          service: zanacoPayload.service,
          validationErrors,
        });
        return NextResponse.json(
          { success: false, error: 'Invalid Zanaco transfer', validationErrors },
          { status: 400 },
        );
      }
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : 'Internal error while validating Zanaco payment.' },
        { status: 500 },
      );
    }
  }

  // ... rest of your code continues here ...
  const queueId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const paymentId = resolvePaymentId(payment as { paymentId?: string }, queueId);
  terminalLog('posted_payments.queue.prepare', { queueId, paymentId, bankCode, sourceBank: sourceBankCode });

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

  try {
    const db = await getSequelize();
    await db.transaction(async transaction => {
      await PaymentDispatchReservation.create({ paymentKey: createHash('sha256').update(paymentId).digest('hex'), queueId, bankCode }, { transaction });
      await PaymentQueueRequest.create({ queueId, paymentId, bankCode, sourceBank: sourceBankCode,
        paymentPayload: JSON.stringify(paymentToQueue), status: 'queued', attempts: 0 }, { transaction });
    });
    terminalLog('posted_payments.queue.persisted', { queueId, paymentId, bankCode, sourceBank: sourceBankCode });
  } catch (error: any) {
    if (error?.name === 'SequelizeUniqueConstraintError') {
      terminalLog('posted_payments.queue.duplicate_reservation', { paymentId, bankCode, sourceBank: sourceBankCode });
      return requeueFailedReservedPayment({
        request,
        auth,
        payment,
        paymentId,
        bankCode,
        sourceBankCode,
      });
    }
    throw error;
  }

  // If the payment is intended for IZB, also insert into the intermediary izB pending table
  try {
    if (bankCode === 'IZB') {
      const paymentDateStr = (payment as any)?.transactionDate || (payment as any)?.paymentDate || null;
      const paymentDate = paymentDateStr ? new Date(paymentDateStr) : null;
      await IzbPayment.create({
        paymentId,
        paymentDate,
        sourceBank: sourceBankCode ?? 'IZB',
        paymentPayload: JSON.stringify(payment),
        status: 'queued',
        attempts: 0,
      });
    }
  } catch (err) {
    console.error('Failed to insert IZB intermediary record', err);
  }

  const queueItem = enqueuePayment(bankCode, paymentToQueue, queueId, sourceBankCode);
  const integration = getBankIntegration(bankCode);
  let latestQueueItem = queueItem;
  if (integration.dispatchStrategy === 'portal-push') {
    latestQueueItem = await ensureQueueItemProcessing(queueItem.id) ?? queueItem;
  }
  terminalLog('posted_payments.queue.response', {
    queueId: latestQueueItem.id,
    paymentId,
    bankCode,
    status: latestQueueItem.status,
    attempts: latestQueueItem.attempts,
    lastError: latestQueueItem.lastError,
    dispatchStrategy: integration.dispatchStrategy,
  });

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
    correlationId: queueId,
    summary: `${auth.username} posted payment ${paymentRef} to ${bankCode}`,
    details: {
      queueId,
      paymentId,
      bankCode,
      sourceBank: sourceBankCode,
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
          sourceBank: sourceBankCode,
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
    queueId: latestQueueItem.id,
    status: latestQueueItem.status,
    item: latestQueueItem,
    dispatchStrategy: integration.dispatchStrategy,
  });
}

async function requeueFailedReservedPayment(input: {
  request: NextRequest;
  auth: { id: number; username: string };
  payment: PaymentsResponse;
  paymentId: string;
  bankCode: BankCode;
  sourceBankCode: string | null;
}) {
  const { request, auth, payment, paymentId, bankCode, sourceBankCode } = input;
  const paymentKey = createHash('sha256').update(paymentId).digest('hex');
  const reservation = await PaymentDispatchReservation.findOne({ where: { paymentKey } });
  terminalLog('posted_payments.retry.lookup', { paymentId, bankCode, sourceBank: sourceBankCode, hasReservation: Boolean(reservation) });

  if (!reservation) {
    return NextResponse.json(
      { success: false, error: 'This payment already has a bank dispatch reservation', alreadyPosted: true, paymentId },
      { status: 409 },
    );
  }

  const queueRecord = await PaymentQueueRequest.findOne({ where: { queueId: reservation.queueId } });
  if (!queueRecord) {
    terminalError('posted_payments.retry.queue_missing', { paymentId, bankCode, queueId: reservation.queueId });
    return NextResponse.json(
      { success: false, error: 'This payment has a dispatch reservation but no queue record to retry.', alreadyPosted: true, paymentId, queueId: reservation.queueId },
      { status: 409 },
    );
  }

  if (queueRecord.bankCode !== bankCode) {
    terminalError('posted_payments.retry.bank_mismatch', { paymentId, requestedBankCode: bankCode, existingBankCode: queueRecord.bankCode, queueId: queueRecord.queueId });
    return NextResponse.json(
      { success: false, error: `Payment has already been reserved for ${queueRecord.bankCode}. Each payment can only be sent to one bank.`, alreadyPosted: true, paymentId, queueId: queueRecord.queueId },
      { status: 409 },
    );
  }

  if (queueRecord.status !== 'failed') {
    terminalLog('posted_payments.retry.blocked_active_record', { paymentId, bankCode, queueId: queueRecord.queueId, status: queueRecord.status });
    return NextResponse.json(
      { success: false, error: buildAlreadyPostedMessage({ source: 'bank_queue', queueId: queueRecord.queueId, status: queueRecord.status, bankCode }, bankCode), alreadyPosted: true, paymentId, queueId: queueRecord.queueId, existingStatus: queueRecord.status },
      { status: 409 },
    );
  }

  await PaymentQueueRequest.update(
    ({
      sourceBank: sourceBankCode,
      paymentPayload: JSON.stringify(payment),
      status: 'queued',
      attempts: 0,
      lastError: null,
      responsePayload: null,
    } as any),
    { where: { queueId: queueRecord.queueId } },
  );
  terminalLog('posted_payments.retry.requeued', { paymentId, bankCode, queueId: queueRecord.queueId, sourceBank: sourceBankCode });

  const queueItem = enqueuePayment(bankCode, payment, queueRecord.queueId, sourceBankCode);
  const integration = getBankIntegration(bankCode);
  const latestQueueItem = integration.dispatchStrategy === 'portal-push'
    ? await ensureQueueItemProcessing(queueItem.id) ?? queueItem
    : queueItem;
  terminalLog('posted_payments.retry.response', {
    paymentId,
    bankCode,
    queueId: latestQueueItem.id,
    status: latestQueueItem.status,
    attempts: latestQueueItem.attempts,
    lastError: latestQueueItem.lastError,
  });

  await logAuditEvent({
    userId: auth.id,
    username: auth.username,
    action: 'PAYMENT_POSTED',
    resourceType: 'payment',
    resourceId: paymentId,
    correlationId: queueRecord.queueId,
    summary: `${auth.username} retried failed payment ${paymentId} to ${bankCode}`,
    details: {
      queueId: queueRecord.queueId,
      paymentId,
      bankCode,
      sourceBank: sourceBankCode,
      retried: true,
    },
    request,
  });

  return NextResponse.json({
    success: true,
    retried: true,
    queueId: latestQueueItem.id,
    status: latestQueueItem.status,
    item: latestQueueItem,
    dispatchStrategy: integration.dispatchStrategy,
  });
}

async function postManyPayments(input: {
  request: NextRequest;
  auth: { id: number; username: string };
  bankCode: BankCode;
  payments: PaymentsResponse[];
  sourceBankCode: string | null;
  transactionType?: PaymentsResponse['transactionType'];
}) {
  const { request, auth, bankCode, payments, sourceBankCode, transactionType } = input;
  terminalLog('posted_payments.bulk.received', {
    bankCode,
    sourceBank: sourceBankCode,
    paymentCount: payments.length,
    transactionType,
  });

  if (!payments.length) {
    terminalError('posted_payments.bulk.validation_failed', { bankCode, error: 'payments must contain at least one payment' });
    return NextResponse.json({ success: false, error: 'payments must contain at least one payment' }, { status: 400 });
  }

  if (payments.length === 1) {
    terminalError('posted_payments.bulk.validation_failed', { bankCode, error: 'single payment sent through bulk path' });
    return NextResponse.json(
      { success: false, error: 'Use payment for a single payment submission; payments is reserved for bulk submissions.' },
      { status: 400 },
    );
  }

  if (bankCode !== 'ZANACO') {
    terminalError('posted_payments.bulk.validation_failed', { bankCode, error: 'bulk flow not configured for bank' });
    return NextResponse.json(
      { success: false, error: `${bankCode} does not have a configured bulk upload flow. Submit those payments individually.` },
      { status: 400 },
    );
  }

  if (!sourceBankCode) {
    terminalError('posted_payments.bulk.validation_failed', { bankCode, error: 'sourceBank is required' });
    return NextResponse.json(
      { success: false, error: 'sourceBank is REQUIRED for Zanaco bulk payments because ZWS requires a debitAccount.' },
      { status: 400 },
    );
  }

  const effectiveType = String(transactionType ?? payments[0].transactionType ?? '').toUpperCase() as PaymentsResponse['transactionType'];
  const sameType = payments.every((row) => String(row.transactionType ?? effectiveType).toUpperCase() === effectiveType);
  if (!sameType) {
    terminalError('posted_payments.bulk.validation_failed', { bankCode, transactionType: effectiveType, error: 'mixed transaction types' });
    return NextResponse.json(
      { success: false, error: 'Bulk payments must use one transaction type. Split the selection by transaction type.' },
      { status: 400 },
    );
  }

  const source = await resolveSourceBank(sourceBankCode);
  if (!source?.accountNumber) {
    terminalError('posted_payments.bulk.validation_failed', { bankCode, sourceBank: sourceBankCode, error: 'source bank has no valid account number' });
    return NextResponse.json(
      { success: false, error: `Payment CANNOT be posted: Source bank "${sourceBankCode}" has no valid account number.` },
      { status: 400 },
    );
  }

  await connectDatabase();

  const queueId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const batchPaymentId = `zanaco-bulk-${queueId}`;
  const service = zanacoBulkServiceFor(effectiveType);
  const itemRequests: Record<string, unknown>[] = [];
  const validationByPayment: Record<string, string[]> = {};

  for (const row of payments) {
    const paymentId = resolvePaymentId(row as { paymentId?: string }, '');
    const existingPost = await findExistingPaymentPost(paymentId);
    if (existingPost) {
      validationByPayment[paymentId] = [buildAlreadyPostedMessage(existingPost, bankCode)];
      terminalError('posted_payments.bulk.payment_rejected', { paymentId, bankCode, error: validationByPayment[paymentId].join('; ') });
      continue;
    }

    const effectivePayment = { ...row, transactionType: effectiveType };
    const zanacoPayload = buildZanacoPayload(effectivePayment, effectiveType, source);
    const validationErrors = validateZanacoPayload(zanacoPayload);
    if (validationErrors.length) {
      validationByPayment[paymentId] = validationErrors;
      terminalError('posted_payments.bulk.payment_rejected', { paymentId, bankCode, validationErrors });
      continue;
    }
    itemRequests.push(zanacoPayload.request);
  }

  if (Object.keys(validationByPayment).length) {
    terminalError('posted_payments.bulk.validation_failed', {
      bankCode,
      sourceBank: sourceBankCode,
      transactionType: effectiveType,
      rejectedCount: Object.keys(validationByPayment).length,
    });
    return NextResponse.json(
      { success: false, error: 'One or more payments cannot be added to the Zanaco bulk batch.', validationByPayment },
      { status: 400 },
    );
  }

  const totalAmount = itemRequests.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const currency = String(itemRequests[0]?.ccy ?? 'ZMW');
  const bulkPayload = {
    service,
    request: {
      batchName: `${service.replace('ZANACO_BULK_', '')}-${new Date().toISOString().slice(0, 10)}-${queueId.slice(0, 8)}`,
      description: `Portal bulk batch for ${effectiveType}`,
      currency,
      valueDate: String(itemRequests[0]?.valueDate ?? new Date().toISOString().slice(0, 10)),
      totalCount: itemRequests.length,
      totalAmount: Number(totalAmount.toFixed(2)),
      items: itemRequests,
    },
    meta: {
      paymentIds: payments.map((row) => resolvePaymentId(row as { paymentId?: string }, '')),
      transactionType: effectiveType,
      sourceBank: sourceBankCode,
    },
  };

  try {
    const db = await getSequelize();
    await db.transaction(async transaction => {
      await PaymentQueueRequest.create({
        queueId,
        paymentId: batchPaymentId,
        bankCode,
        sourceBank: sourceBankCode,
        paymentPayload: JSON.stringify(bulkPayload),
        status: 'queued',
        attempts: 0,
      }, { transaction });

      for (const row of payments) {
        const paymentId = resolvePaymentId(row as { paymentId?: string }, queueId);
        await PaymentDispatchReservation.create({
          paymentKey: createHash('sha256').update(paymentId).digest('hex'),
          queueId,
          bankCode,
        }, { transaction });
      }
    });
    terminalLog('posted_payments.bulk.persisted', {
      queueId,
      paymentId: batchPaymentId,
      bankCode,
      sourceBank: sourceBankCode,
      paymentCount: payments.length,
      service,
      totalAmount,
      currency,
    });
  } catch (error: any) {
    if (error?.name === 'SequelizeUniqueConstraintError') {
      terminalError('posted_payments.bulk.duplicate_reservation', { bankCode, sourceBank: sourceBankCode, paymentCount: payments.length });
      return NextResponse.json(
        { success: false, error: 'At least one selected payment already has a bank dispatch reservation.', alreadyPosted: true },
        { status: 409 },
      );
    }
    throw error;
  }

  const queueItem = enqueuePayment(bankCode, bulkPayload as unknown as PaymentsResponse, queueId, sourceBankCode);
  const integration = getBankIntegration(bankCode);
  let latestQueueItem = queueItem;
  if (integration.dispatchStrategy === 'portal-push') {
    latestQueueItem = await ensureQueueItemProcessing(queueItem.id) ?? queueItem;
  }
  terminalLog('posted_payments.bulk.response', {
    queueId,
    paymentId: batchPaymentId,
    bankCode,
    status: latestQueueItem.status,
    attempts: latestQueueItem.attempts,
    lastError: latestQueueItem.lastError,
    dispatchStrategy: integration.dispatchStrategy,
  });

  await logAuditEvent({
    userId: auth.id,
    username: auth.username,
    action: 'PAYMENT_POSTED',
    resourceType: 'payment',
    resourceId: batchPaymentId,
    correlationId: queueId,
    summary: `${auth.username} queued ${payments.length} payments to ${bankCode} as ${effectiveType} bulk batch`,
    details: {
      queueId,
      paymentIds: bulkPayload.meta.paymentIds,
      bankCode,
      sourceBank: sourceBankCode,
      transactionType: effectiveType,
      service,
      totalAmount,
      currency,
    },
    request,
  });

  return NextResponse.json({
    success: true,
    bulk: true,
    queueId,
    paymentId: batchPaymentId,
    status: latestQueueItem.status,
    item: latestQueueItem,
    paymentIds: bulkPayload.meta.paymentIds,
    dispatchStrategy: integration.dispatchStrategy,
  }, { status: 202 });
}

function zanacoBulkServiceFor(transactionType: PaymentsResponse['transactionType']) {
  const type = String(transactionType || '').toUpperCase();
  if (type === 'INT') return 'ZANACO_BULK_INTERNAL';
  if (type === 'DDACCT' || type === 'DDAC') return 'ZANACO_BULK_DDAC';
  if (type === 'TT' || type === 'SWIFT') return 'ZANACO_BULK_SWIFT';
  return 'ZANACO_BULK_RTGS';
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

  const portalPushBanks = BANK_CODES.filter(
    (code) => getBankIntegration(code).dispatchStrategy === 'portal-push',
  );

  if (portalPushBanks.length) {
    const candidateWhere: any = {
      bankCode: portalPushBanks,
      status: ['queued', 'processing'],
    };
    if (bankCode) candidateWhere.bankCode = bankCode;
    if (sourceBank) candidateWhere.sourceBank = sourceBank;

    const candidateRecords = await PaymentQueueRequest.findAll({
      where: candidateWhere,
      order: [['updatedAt', 'ASC']],
      limit: Number(process.env.QUEUE_RECOVERY_BATCH_SIZE || 10),
    });

    await Promise.all(candidateRecords.map(async (record) => {
      // Persisted protocol is authoritative across rollout and rollback.
      if (JSON.parse(record.paymentPayload)?.h2hProtocol === 'h2h-v1') return;
      if (record.status === 'queued') {
        await rehydrateAndProcessQueueRecord(record);
        return;
      }

      if (isStaleProcessingRecord(record)) {
        await PaymentQueueRequest.update(
          {
            status: record.bankCode === 'ZICB' ? 'unknown' : 'failed',
            lastError: `Timed out waiting for ${record.bankCode} agent callback. Check agent worker, APP_API_URL, and BANK_PULL_API_KEY.`,
            lockedBy: null,
            lockedAt: null,
          } as any,
          { where: { queueId: record.queueId } },
        );
      }
    }));
  }

  if (queueId) {
    const record = await PaymentQueueRequest.findOne({ where: { queueId } });
    if (record) {
      const item = mapQueueRecordToItem(record);
      if (!item) {
        return NextResponse.json({ success: false, error: 'Invalid saved queue payload' }, { status: 500 });
      }
      return NextResponse.json({ success: true, item });
    }

    const queueItem = getQueueItem(queueId);
    if (queueItem) {
      const integration = getBankIntegration(queueItem.bankCode);
      if (integration.dispatchStrategy === 'portal-push') {
        await ensureQueueItemProcessing(queueId);
      }
      return NextResponse.json({ success: true, item: queueItem });
    }

    return NextResponse.json({ success: false, error: 'Queue item not found' }, { status: 404 });
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

  const mergedById = new Map<string, BankQueueItem>();
  for (const item of memoryItems) {
    mergedById.set(item.id, item);
  }
  for (const item of dbItems) {
    // Persisted rows are authoritative because agents report results to the DB.
    mergedById.set(item.id, item);
  }
  const mergedItems = Array.from(mergedById.values());

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
