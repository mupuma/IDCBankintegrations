import { createHash, randomUUID } from 'node:crypto';
import { Op } from 'sequelize';
import { connectDatabase, getSequelize } from './db';
import { PaymentQueueRequest } from '@/app/models/internal/PaymentQueueRequest';
import { PaymentRecoveryAction } from '@/app/models/internal/PaymentRecoveryAction';
import { PaymentDispatchReservation, ZicbH2hPayment } from '@/app/models/internal/ZicbH2hPayment';
import { createH2hRecoveryAttempt, recoverH2hInstruction, documentOf } from './zicb/ledger';
import { resolveSourceBank } from './sourceAccounts';
import { buildZanacoPayload, validateZanacoPayload } from './banks/payloadBuilders';
import { recoveryActions, correctedPayment, type RecoveryAction, type RecoveryEvidence } from './paymentRecoveryPolicy';
import { sourceProfile } from './zicb/config';
import { buildBatch, channelFor } from '../../../shared/zicb-h2h';

export class RecoveryError extends Error { constructor(message: string, public status = 409) { super(message); } }
const parse = (value?: string | null) => value ? JSON.parse(value) : {};
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const ACTIONS: RecoveryAction[] = ['retry_connection', 'check_status', 'retry_reporting', 'retry_accounting', 'new_attempt'];

function evidenceOf(row: PaymentQueueRequest, h2h?: ZicbH2hPayment | null) {
  if (row.bankCode === 'ZICB' && h2h) {
    const doc = documentOf(h2h);
    return { protocol: 'zicb-recovery-v1', notSent: doc.notSent, retryable: doc.notSentReason === 'authentication', confirmedRejected: doc.confirmedRejected };
  }
  const evidence = parse(row.responsePayload).recovery as RecoveryEvidence | undefined;
  return evidence?.protocol === 'zanaco-recovery-v1' ? evidence : {};
}

export async function getRecoveryDetails(queueId: string) {
  await connectDatabase();
  const row = await PaymentQueueRequest.findOne({ where: { queueId } });
  if (!row) throw new RecoveryError('Payment not found', 404);
  const h2h = row.bankCode === 'ZICB' ? await ZicbH2hPayment.findByPk(queueId) : null;
  const response = parse(row.responsePayload);
  const history = await PaymentRecoveryAction.findAll({ where: { queueId }, order: [['created_at', 'DESC']], limit: 20 });
  return {
    queueId, bankCode: row.bankCode, status: row.status, payment: parse(row.paymentPayload),
    actions: recoveryActions(row.bankCode, row.status, evidenceOf(row, h2h), response.accountingStatus),
    evidence: evidenceOf(row, h2h),
    history: history.map(action => ({ id: action.actionId, action: action.action, status: action.status,
      requestedBy: action.requestedBy, reason: action.reason, result: parse(action.result), createdAt: action.get('createdAt') })),
  };
}

export async function requestPaymentRecovery(input: {
  queueId: string; action: RecoveryAction; actionId: string; reason: string; corrections?: unknown; confirmed?: boolean; username: string;
}) {
  if (!ACTIONS.includes(input.action) || !/^[a-f0-9-]{36}$/i.test(input.actionId)) throw new RecoveryError('Invalid recovery action or request ID', 400);
  if (input.reason.trim().length < 10 || input.reason.length > 1000) throw new RecoveryError('Enter a recovery reason between 10 and 1000 characters', 400);
  if (input.action === 'new_attempt' && input.confirmed !== true) throw new RecoveryError('Confirm the new submission after reviewing the previous bank outcome', 400);
  await connectDatabase();
  const initial = await PaymentQueueRequest.findOne({ where: { queueId: input.queueId } });
  if (!initial) throw new RecoveryError('Payment not found', 404);
  const source = input.action === 'new_attempt' ? await resolveSourceBank(initial.sourceBank) : null;
  const request = JSON.stringify({ action: input.action, reason: input.reason.trim(), corrections: input.corrections ?? {}, confirmed: input.confirmed === true });
  const db = await getSequelize();
  return db.transaction(async transaction => {
    // Lock the common reservation before the H2H/queue row. Concurrent clicks
    // cannot create two successor instructions for one Sage payment.
    const reservation = await PaymentDispatchReservation.findOne({ where: { paymentKey: hash(initial.paymentId) }, transaction, lock: transaction.LOCK.UPDATE });
    const h2h = initial.bankCode === 'ZICB' ? await ZicbH2hPayment.findByPk(input.queueId, { transaction, lock: transaction.LOCK.UPDATE }) : null;
    const row = await PaymentQueueRequest.findOne({ where: { queueId: input.queueId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!row) throw new RecoveryError('Payment not found', 404);
    const existing = await PaymentRecoveryAction.findByPk(input.actionId, { transaction });
    if (existing) {
      if (existing.queueId !== input.queueId || existing.request !== request || existing.requestedBy !== input.username) throw new RecoveryError('Request ID already belongs to another recovery action');
      return { actionId: existing.actionId, status: existing.status, isNewAction: false, ...parse(existing.result) };
    }
    const pending = await PaymentRecoveryAction.findOne({ where: { activeQueueId: input.queueId }, transaction });
    if (pending) throw new RecoveryError('A recovery action is already pending for this payment');
    const response = parse(row.responsePayload);
    if (!recoveryActions(row.bankCode, row.status, evidenceOf(row, h2h), response.accountingStatus).includes(input.action)) {
      throw new RecoveryError('This action is not permitted by the recorded bank outcome. Unknown or legacy outcomes cannot authorise a new payment.');
    }
    if (reservation && reservation.queueId !== row.queueId && ['new_attempt', 'retry_connection'].includes(input.action)) throw new RecoveryError('This instruction already has a successor. Open the latest queue entry.');
    let result: Record<string, unknown> = {};
    const pendingAgent = row.bankCode === 'ZANACO' && input.action !== 'new_attempt';
    if (input.action === 'new_attempt') {
      if (!reservation) throw new RecoveryError('The original dispatch reservation is missing; manual reconciliation is required');
      const original = h2h ? documentOf(h2h).payment : parse(row.paymentPayload);
      if (original.service || String(original.paymentId) !== row.paymentId) throw new RecoveryError('Bulk or legacy payloads require manual review; only canonical single payments can be corrected here');
      if (!source?.accountNumber || !row.sourceBank) throw new RecoveryError('The original source account is incomplete', 400);
      const payment = correctedPayment(original, input.corrections ?? {});
      payment.recoveryOf = row.queueId;
      let queueId: string;
      if (row.bankCode === 'ZICB') {
        if (!h2h || (h2h.leaseUntil && new Date(h2h.leaseUntil).getTime() > Date.now())) throw new RecoveryError('The bank instruction is still leased by an agent');
        const profile = sourceProfile(row.sourceBank);
        const channel = channelFor(payment.transactionType);
        if (!profile.channels?.includes(channel)) throw new RecoveryError('Source profile does not permit this channel', 400);
        buildBatch(payment, { reference: randomUUID(), prcn: 'RECOVERY_VALIDATION', regionCode: profile.regionCode, amountScale: profile.amountScale });
        queueId = await createH2hRecoveryAttempt(payment, row.sourceBank, row.queueId, transaction);
      } else {
        queueId = randomUUID(); payment.recoveryAttemptId = queueId;
        payment.srcAcc = source.accountNumber; payment.srcBranch = source.transit; payment.srcName = source.name;
        const errors = validateZanacoPayload(buildZanacoPayload(payment as any, payment.transactionType, source));
        if (errors.length) throw new RecoveryError(errors.join('; '), 400);
        await PaymentQueueRequest.create({ queueId, paymentId: row.paymentId, bankCode: 'ZANACO', sourceBank: row.sourceBank,
          paymentPayload: JSON.stringify(payment), status: 'queued', attempts: 0 }, { transaction });
      }
      await reservation.update({ queueId }, { transaction });
      result = { queueId, message: 'A new instruction was created; the original instruction and its history are preserved.' };
    } else if (row.bankCode === 'ZICB') {
      await recoverH2hInstruction(row.queueId, input.action as 'retry_connection' | 'check_status' | 'retry_accounting', transaction);
      result = { message: 'Recovery scheduled on the original instruction.' };
    }
    const action = await PaymentRecoveryAction.create({ actionId: input.actionId, queueId: row.queueId,
      activeQueueId: pendingAgent ? row.queueId : null, bankCode: row.bankCode, action: input.action,
      status: pendingAgent ? 'pending' : 'completed', requestedBy: input.username, reason: input.reason.trim(), request,
      result: pendingAgent ? null : JSON.stringify(result) }, { transaction });
    return { actionId: action.actionId, status: action.status, isNewAction: true, ...result };
  });
}

export async function claimZanacoRecovery() {
  await connectDatabase();
  const db = await getSequelize();
  return db.transaction(async transaction => {
    const action = await PaymentRecoveryAction.findOne({ where: { bankCode: 'ZANACO',
      [Op.or]: [{ status: 'pending' }, { status: 'processing', leaseUntil: { [Op.lte]: new Date() } }] },
      order: [['created_at', 'ASC']], transaction, lock: transaction.LOCK.UPDATE });
    if (!action) return null;
    action.status = 'processing'; action.leaseToken = randomUUID(); action.leaseUntil = new Date(Date.now() + 300000);
    await action.save({ transaction });
    return { actionId: action.actionId, queueId: action.queueId, action: action.action, leaseToken: action.leaseToken };
  });
}

export async function reportZanacoRecovery(actionId: string, leaseToken: string, success: boolean, message: string) {
  await connectDatabase();
  const db = await getSequelize();
  return db.transaction(async transaction => {
    const action = await PaymentRecoveryAction.findByPk(actionId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!action || action.bankCode !== 'ZANACO') throw new RecoveryError('Recovery request not found', 404);
    if (action.status === 'completed' || action.status === 'failed') return;
    if (!leaseToken || action.leaseToken !== leaseToken) throw new RecoveryError('Recovery lease is no longer current');
    action.status = success ? 'completed' : 'failed'; action.result = JSON.stringify({ message: message.slice(0, 1000) });
    action.activeQueueId = null; action.leaseToken = null; action.leaseUntil = null;
    await action.save({ transaction });
  });
}
