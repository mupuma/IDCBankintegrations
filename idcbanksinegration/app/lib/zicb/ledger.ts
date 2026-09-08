import { createHash, randomUUID } from 'node:crypto';
import { Op, Transaction } from 'sequelize';
import { connectDatabase, getSequelize } from '../db';
import { PaymentQueueRequest } from '@/app/models/internal/PaymentQueueRequest';
import { ZicbH2hPayment, ZicbH2hEvent, PaymentDispatchReservation } from '@/app/models/internal/ZicbH2hPayment';
import { buildBatch, channelFor, mergeOutcome, callbackErrors, type Batch, type Channel, type State, type Outcome } from '../../../../shared/zicb-h2h';
import { sourceProfile, reconcileDelay } from './config';
import { findExistingPaymentPost } from '../paymentPostGuard';

export type LedgerDocument = {
  payment: any; batch: Batch; profileId: string; sourceBank: string; amountScale: number;
  accounting: 'pending' | 'processing' | 'retry' | 'posted' | 'needs_review';
  accountingId: string; cashbookAccount?: string; accountingAttempts: number;
  submissionAttempts: number; submittedAt?: string; bankRef?: string; rawStatus?: string;
  error?: string; accountingError?: string; lastAction?: 'submit' | 'reconcile' | 'accounting';
};
export function documentOf(row: ZicbH2hPayment): LedgerDocument { return JSON.parse(row.document); }
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export class LedgerError extends Error { constructor(message: string, public status = 400) { super(message); } }

async function event(row: ZicbH2hPayment, kind: string, payload: unknown, transaction: Transaction, eventId = randomUUID() as string) {
  await ZicbH2hEvent.create({ eventId, queueId: row.queueId, kind, payload: JSON.stringify(payload) }, { transaction });
}
async function persist(row: ZicbH2hPayment, doc: LedgerDocument, transaction: Transaction) {
  row.document = JSON.stringify(doc);
  await row.save({ transaction });
  await PaymentQueueRequest.update({
    status: row.state, attempts: doc.submissionAttempts, lastError: doc.error || null,
    responsePayload: JSON.stringify({ protocol: 'h2h-v1', reference: row.reference, prcn_number: row.prcn,
      channel: row.channel, bankRef: doc.bankRef, bankStatus: doc.rawStatus,
      accountingStatus: doc.accounting, accountingError: doc.accountingError }),
  } as any, { where: { queueId: row.queueId }, transaction });
}

export async function enqueueH2h(payment: any, sourceBank: string) {
  const profile = sourceProfile(sourceBank);
  const channel = channelFor(payment.transactionType);
  if (!profile.channels?.includes(channel)) throw new LedgerError('This H2H channel is not enabled for the selected source account');
  const currency = String(payment.currency || payment.currencyCode || '').toUpperCase();
  if (currency !== profile.currency) throw new LedgerError('Payment currency does not match the bank-approved source account profile');
  const paymentId = String(payment.paymentId ?? '').trim();
  if (!paymentId) throw new LedgerError('A stable Sage paymentId is required');
  const queueId = randomUUID(), reference = randomUUID();
  const prcn = `IDC${hash(paymentId).slice(0, 32)}`;
  const batch = buildBatch(payment, { reference, prcn, regionCode: profile.regionCode, amountScale: profile.amountScale });
  await connectDatabase();
  const db = await getSequelize();
  try {
    return await db.transaction(async transaction => {
      await PaymentDispatchReservation.create({ paymentKey: hash(paymentId), queueId, bankCode: 'ZICB' }, { transaction });
      if (await findExistingPaymentPost(paymentId, transaction)) throw new LedgerError('This payment already has a bank instruction; reconcile it before submitting again', 409);
      const doc: LedgerDocument = {
        payment: { ...payment, paymentId, currency, h2hProtocol: 'h2h-v1' }, batch, profileId: profile.profileId,
        sourceBank, amountScale: profile.amountScale, accounting: 'pending',
        accountingId: `ZH${hash(paymentId).slice(0, 20)}`, cashbookAccount: profile.cashbookAccount,
        accountingAttempts: 0, submissionAttempts: 0,
      };
      const row = await ZicbH2hPayment.create({ queueId, paymentKey: hash(paymentId), reference, prcn,
        channel, state: 'queued', document: JSON.stringify(doc), nextRun: new Date() }, { transaction });
      await PaymentQueueRequest.create({ queueId, paymentId, bankCode: 'ZICB', sourceBank,
        paymentPayload: JSON.stringify(doc.payment), status: 'queued', attempts: 0 }, { transaction });
      await event(row, 'created', { channel, reference, prcn, profileId: profile.profileId }, transaction);
      await persist(row, doc, transaction);
      return { queueId, paymentId, status: 'queued', reference, prcn_number: prcn };
    });
  } catch (error: any) {
    if (error?.name === 'SequelizeUniqueConstraintError') throw new LedgerError('This payment already has an H2H instruction', 409);
    throw error;
  }
}

export async function claimH2hWork() {
  await connectDatabase();
  const db = await getSequelize();
  return db.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async transaction => {
    const now = new Date();
    const row = await ZicbH2hPayment.findOne({
      where: { nextRun: { [Op.lte]: now }, [Op.or]: [{ leaseUntil: null }, { leaseUntil: { [Op.lte]: now } }] },
      order: [['next_run', 'ASC']], lock: transaction.LOCK.UPDATE, transaction,
    });
    if (!row) return null;
    const doc = documentOf(row);
    // A claimed submission could have reached the bank before the worker died.
    // Recovery therefore queries its existing reference, never sends it again.
    if (row.state === 'submitting') {
      row.state = 'unknown'; doc.error = 'Submission lease expired; checking original bank reference';
      row.leaseUntil = null; row.leaseToken = null; row.nextRun = new Date(Date.now() + reconcileDelay());
      await event(row, 'submission_interrupted', {}, transaction);
      await persist(row, doc, transaction);
      return null;
    }
    let action: 'submit' | 'reconcile' | 'accounting';
    if (row.state === 'queued') {
      action = 'submit'; row.state = 'submitting'; doc.submissionAttempts += 1;
      doc.submittedAt = now.toISOString();
    } else if (['accepted', 'unknown'].includes(row.state)) action = 'reconcile';
    else if (row.state === 'paid' && ['pending', 'retry', 'processing'].includes(doc.accounting)) {
      action = 'accounting'; doc.accounting = 'processing'; doc.accountingAttempts += 1;
    } else { row.nextRun = null; await persist(row, doc, transaction); return null; }
    doc.lastAction = action;
    row.leaseToken = randomUUID(); row.leaseUntil = new Date(Date.now() + 300000);
    row.nextRun = row.leaseUntil;
    await event(row, `${action}_claimed`, { lease: row.leaseToken }, transaction);
    await persist(row, doc, transaction);
    return { queueId: row.queueId, leaseToken: row.leaseToken, channel: row.channel as Channel,
      action, batch: doc.batch, profileId: doc.profileId, amountScale: doc.amountScale };
  });
}

export async function reportH2hWork(queueId: string, leaseToken: string, outcome: Outcome) {
  if (!['accepted', 'unknown', 'paid', 'failed', 'rejected', 'needs_review'].includes(outcome.state)) throw new LedgerError('Invalid H2H outcome');
  await connectDatabase();
  const db = await getSequelize();
  return db.transaction(async transaction => {
    const row = await ZicbH2hPayment.findByPk(queueId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!row) throw new LedgerError('Payment not found', 404);
    const doc = documentOf(row);
    // A durable report event makes a retry after a lost HTTP response a no-op.
    const reportId = hash(`report:${queueId}:${leaseToken}`);
    const previous = await ZicbH2hEvent.findByPk(reportId, { transaction });
    if (previous) return;
    if (!leaseToken || row.leaseToken !== leaseToken || doc.lastAction === 'accounting') throw new LedgerError('Work lease is no longer current', 409);
    if (doc.lastAction === 'submit' && ['paid', 'failed'].includes(outcome.state)) throw new LedgerError('Submission cannot establish settlement');
    if (outcome.state === 'paid' && !outcome.bankRef?.trim()) throw new LedgerError('Paid outcome requires a bank reference');
    row.state = mergeOutcome(row.state as State, outcome.state);
    if (doc.bankRef && outcome.bankRef && doc.bankRef !== outcome.bankRef) row.state = 'needs_review';
    if (outcome.bankRef) doc.bankRef = outcome.bankRef;
    if (outcome.rawStatus) doc.rawStatus = outcome.rawStatus;
    doc.error = row.state === 'needs_review' ? outcome.error || 'Conflicting or unconfirmed bank outcome' : outcome.error;
    row.leaseToken = null; row.leaseUntil = null;
    row.nextRun = ['accepted', 'unknown'].includes(row.state) ? new Date(Date.now() + reconcileDelay())
      : row.state === 'paid' && doc.accounting !== 'posted' ? new Date() : null;
    await event(row, 'bank_report', outcome, transaction, reportId);
    await persist(row, doc, transaction);
  });
}

export async function receiveH2hCallback(channel: Channel, body: any) {
  const errors = callbackErrors(body);
  if (errors.length) throw new LedgerError(errors.join('; '));
  await connectDatabase();
  const db = await getSequelize();
  return db.transaction(async transaction => {
    const row = await ZicbH2hPayment.findOne({ where: { reference: body.reference, prcn: body.prcn_number, channel }, transaction, lock: transaction.LOCK.UPDATE });
    if (!row) throw new LedgerError('Unknown batch/item reference', 404);
    const id = hash(JSON.stringify([channel, body.reference, body.prcn_number, body.status_code, body.bankRef || '']));
    if (await ZicbH2hEvent.findByPk(id, { transaction })) throw new LedgerError('Reference has already been processed', 409);
    const doc = documentOf(row);
    if (!doc.submittedAt) throw new LedgerError('Payment has not been submitted', 409);
    row.state = mergeOutcome(row.state as State, body.status_code === 200 ? 'paid' : 'failed');
    if (doc.bankRef && body.bankRef && doc.bankRef !== body.bankRef) row.state = 'needs_review';
    if (body.bankRef) doc.bankRef = body.bankRef;
    doc.error = row.state === 'needs_review' ? 'Conflicting bank notifications; manual review required' : body.status_code === 400 ? String(body.message || 'Bank reported payment failure') : undefined;
    // Preserve an in-flight submit/reconcile lease: its late report is harmless
    // and must not cancel or cause a second accounting action.
    row.nextRun = row.state === 'paid' && doc.accounting !== 'posted' ? new Date() : null;
    await event(row, 'callback', body, transaction, id);
    await persist(row, doc, transaction);
  });
}

export async function withAccountingLease(queueId: string, leaseToken: string, run: (doc: LedgerDocument) => Promise<{ posted: boolean; error?: string; review?: boolean }>) {
  await connectDatabase();
  const db = await getSequelize();
  // Hold the row lock across the accounting call. A second claimant cannot run
  // the same accounting action while the first is still writing to Sage.
  return db.transaction(async transaction => {
    const row = await ZicbH2hPayment.findByPk(queueId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!row) throw new LedgerError('Payment not found', 404);
    const doc = documentOf(row);
    if (doc.accounting === 'posted') return { posted: true };
    if (row.state !== 'paid' || row.leaseToken !== leaseToken || doc.lastAction !== 'accounting') throw new LedgerError('No current paid-item accounting lease', 409);
    let result;
    try { result = await run(doc); } catch { result = { posted: false, error: 'Accounting service unavailable; retry scheduled' }; }
    doc.accounting = result.posted ? 'posted' : result.review ? 'needs_review' : 'retry';
    doc.accountingError = result.error;
    row.leaseToken = null; row.leaseUntil = null;
    row.nextRun = doc.accounting === 'retry' ? new Date(Date.now() + Math.min(3600000, 30000 * 2 ** Math.min(doc.accountingAttempts, 7))) : null;
    await event(row, 'accounting_result', result, transaction);
    await persist(row, doc, transaction);
    return result;
  });
}
