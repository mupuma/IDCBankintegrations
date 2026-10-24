import { Op } from 'sequelize';
import { connectDatabase } from './db';
import { PaymentQueueRequest } from '@/app/models/internal/PaymentQueueRequest';
import { CashbookReceipt } from '@/app/models/internal/CashbookReceipt';
import { normalizeReceiptRequest } from './cashbookContract';
import { processCashbookReceipt } from './cashbookService';

export class CashbookRecoveryError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}

export async function loadIzbCashbookRecovery(queueId: string) {
  if (!queueId || queueId.length > 100) throw new CashbookRecoveryError('A valid queue ID is required', 400);
  await connectDatabase();
  const queue = await PaymentQueueRequest.findOne({ where: { queueId } });
  if (!queue) throw new CashbookRecoveryError('Payment not found', 404);
  if (queue.bankCode !== 'IZB') throw new CashbookRecoveryError('This control is only for IZB cashbook notifications', 400);
  let payment: Record<string, unknown> = {};
  try { payment = JSON.parse(queue.paymentPayload); } catch { /* Match the canonical queue ID below. */ }
  // Match only original machine identifiers, never narration or bank account.
  const identifiers = [...new Set([queue.paymentId, payment?.paymentId, payment?.transactionId]
    .map(value => String(value ?? '').trim()).filter(Boolean))];
  const receipts = await CashbookReceipt.findAll({
    where: { bankCode: 'IZB', transactionId: { [Op.in]: identifiers } },
    order: [['id', 'DESC']],
  });
  const receipt = receipts.length === 1 ? receipts[0] : null;
  let payload = null;
  try { payload = receipt ? normalizeReceiptRequest(JSON.parse(receipt.paymentPayload)) : null; } catch { /* Invalid saved payload requires review. */ }
  const validPayload = Boolean(receipt && payload && payload.bankCode === 'IZB'
    && payload.transactionId === receipt.transactionId
    && payload.entries.length > 0 && payload.entries.length === payload.noEntries
    && payload.entries.every(entry => entry.referenceNo === receipt.transactionId));
  const canRetry = Boolean(receipt?.status === 'failed' && validPayload);
  const message = receipts.length > 1 ? 'Multiple saved notifications match this payment. Review them before retrying.'
    : !receipt ? 'No saved IZB cashbook notification was found. Ask IZB to resend the original cashbook notification; do not send another bank payment.'
    : !validPayload ? 'The saved notification is invalid or its references do not match. Review it before retrying.'
    : receipt.status === 'success' ? 'Cashbook posting is already complete.'
    : receipt.status !== 'failed' ? 'Cashbook posting is pending or in progress. Another retry is blocked.'
    : 'Retry the saved cashbook notification now, after resolving the reported error. The bank payment will not be sent again.';
  return { queue, receipt, payload, details: {
    queueId, transactionId: receipt?.transactionId || queue.paymentId,
    receiptId: receipt?.id, status: receipt?.status || 'missing',
    lastError: receipt?.statusMessage || '', processedDate: receipt?.processedDate,
    amount: receipt?.debitAmount, canRetry, message,
  } };
}

export async function retryIzbCashbook(queueId: string) {
  const context = await loadIzbCashbookRecovery(queueId);
  if (!context.details.canRetry || !context.payload) throw new CashbookRecoveryError(context.details.message);
  // Financial fields and references come exclusively from the stored bank
  // notification. No bank endpoint or payment queue dispatch is called here.
  const result = await processCashbookReceipt(context.payload);
  if (result.success) return { success: true, message: result.message, batchId: result.batchId };
  if ('error' in result) throw new CashbookRecoveryError(result.error, 502);
  const latest = await loadIzbCashbookRecovery(queueId);
  if (latest.receipt?.status === 'success') return { success: true, message: 'Cashbook posting was already recorded; no duplicate was created.' };
  throw new CashbookRecoveryError('A cashbook posting is already pending or in progress. Refresh to see its result.');
}
