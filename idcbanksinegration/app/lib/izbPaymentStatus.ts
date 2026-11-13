import { Op } from 'sequelize';
import { connectDatabase, getSequelize } from './db';
import { PaymentQueueRequest } from '@/app/models/internal/PaymentQueueRequest';
import { CashbookReceipt } from '@/app/models/internal/CashbookReceipt';
import { AuditLog } from '@/app/models/internal/AuditLog';
import { ProcessedTransaction } from '@/app/models/internal/Processed_transactions';

export class IzbStatusError extends Error { constructor(message: string, public status = 400) { super(message); } }
type Failure = { eventId: string; transactionId: string; queueId?: string; status: 'failed' | 'rejected'; errorCode: string; errorMessage: string; bankReference?: string };
function inputOf(body: unknown): Failure {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new IzbStatusError('A JSON object is required');
  const value = body as Record<string, unknown>;
  const text = (name: string, max: number, required = true) => {
    const item = value[name];
    if (!required && item === undefined) return undefined;
    if (typeof item !== 'string' || !item.trim() || item.length > max || /[\x00-\x1f]/.test(item)) throw new IzbStatusError(`Invalid ${name}; provide 1-${max} characters`);
    return item.trim();
  };
  if (!['failed', 'rejected'].includes(String(value.status))) throw new IzbStatusError('status must be failed or rejected; successful payments use postCBTxn');
  return { eventId: text('eventId', 100)!, transactionId: text('transactionId', 100)!, queueId: text('queueId', 100, false),
    status: value.status as Failure['status'], errorCode: text('errorCode', 100)!, errorMessage: text('errorMessage', 1000)!, bankReference: text('bankReference', 100, false) };
}
function identifiersOf(row: PaymentQueueRequest) {
  let payment: Record<string, unknown> = {};
  try { payment = JSON.parse(row.paymentPayload); } catch { /* retain the canonical paymentId */ }
  // Each corrected attempt has its own bank-facing identity. Delayed callbacks
  // for the predecessor must never update the successor sharing its Sage ID.
  if (payment.izbAttemptReference) return [String(payment.izbAttemptReference).trim()];
  return [...new Set([row.paymentId, payment?.paymentId, payment?.transactionId].filter(value => typeof value === 'string' && value.trim()).map(value => String(value).trim()))];
}

export async function recordIzbPaymentFailure(body: unknown) {
  const input = inputOf(body);
  await connectDatabase();
  const db = await getSequelize();
  return db.transaction(async transaction => {
    // Fast canonical lookup, followed by exact legacy payload aliases if needed.
    let candidates = await PaymentQueueRequest.findAll({ where: { bankCode: 'IZB', ...(input.queueId ? { queueId: input.queueId } : { paymentId: input.transactionId }) }, transaction });
    if (!candidates.length && !input.queueId) candidates = await PaymentQueueRequest.findAll({ where: { bankCode: 'IZB' }, transaction });
    const matches = candidates.filter(row => identifiersOf(row).includes(input.transactionId));
    if (!matches.length) throw new IzbStatusError('No IZB payment matches transactionId', 404);
    if (matches.length !== 1) throw new IzbStatusError('Multiple instructions match transactionId; include the original queueId', 409);
    const row = await PaymentQueueRequest.findOne({ where: { queueId: matches[0].queueId, bankCode: 'IZB' }, transaction, lock: transaction.LOCK.UPDATE });
    if (!row || !identifiersOf(row).includes(input.transactionId)) throw new IzbStatusError('Payment identity changed; reconcile before retrying', 409);
    const payload = JSON.stringify(input);
    // A locking read sees the preceding callback's committed audit even under
    // MySQL REPEATABLE READ, after waiting for the queue row lock above.
    const previous = await AuditLog.findOne({ where: { action: 'IZB_PAYMENT_FAILED', resourceId: row.queueId, correlationId: input.eventId }, transaction, lock: transaction.LOCK.UPDATE });
    if (previous) {
      if (previous.details !== payload) throw new IzbStatusError('eventId already belongs to a different callback', 409);
      return { responseCode: 200, responseMessage: 'Failure notification already recorded', duplicate: true, transactionId: input.transactionId, queueId: row.queueId, status: row.status };
    }
    if (!['pulled', 'processing', 'accepted', 'unknown', 'failed'].includes(row.status)) throw new IzbStatusError('Payment is not awaiting an IZB result or already has a final outcome', 409);
    const receipt = await CashbookReceipt.findOne({ where: { bankCode: 'IZB', transactionId: { [Op.in]: identifiersOf(row) } }, transaction, lock: transaction.LOCK.UPDATE });
    const processed = await ProcessedTransaction.findOne({ where: { bankCode: 'IZB', transactionId: { [Op.in]: identifiersOf(row) } }, transaction, lock: transaction.LOCK.UPDATE });
    if (receipt || processed) throw new IzbStatusError('A cashbook notification already exists; reconcile the conflicting bank outcome instead of replacing it', 409);
    const receivedAt = new Date().toISOString();
    await row.update({ status: 'failed', lastError: `${input.errorCode}: ${input.errorMessage}`,
      responsePayload: JSON.stringify({ protocol: 'izb-bank-status-v1', bankCode: 'IZB', bankStatus: input.status,
        eventId: input.eventId, transactionId: input.transactionId, errorCode: input.errorCode, message: input.errorMessage, bankReference: input.bankReference, receivedAt }),
      lockedBy: null, lockedAt: null,
    } as any, { transaction });
    await AuditLog.create({ userId: null, username: 'izb-bank', action: 'IZB_PAYMENT_FAILED', resourceType: 'payment_queue',
      resourceId: row.queueId, correlationId: input.eventId, summary: `IZB ${input.status}: ${input.errorCode}`.slice(0, 500),
      details: payload, ipAddress: null, userAgent: null,
    }, { transaction });
    return { responseCode: 200, responseMessage: 'Bank failure recorded; no cashbook was posted', duplicate: false, transactionId: input.transactionId, queueId: row.queueId, status: 'failed' };
  });
}
