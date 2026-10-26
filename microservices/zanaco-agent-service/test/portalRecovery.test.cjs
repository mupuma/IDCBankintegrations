const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { load, builders } = require('./helpers/portal.cjs');
const policy = load('idcbanksinegration/app/lib/paymentRecoveryPolicy.ts');
const id = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';

function fixture({ bank = 'ZANACO', status = 'failed', evidence = { confirmedRejected: true }, role = 'ADMIN', bankEnabled = true } = {}) {
  const payment = { paymentId: 'SAGE1', amount: 10, currency: 'ZMW', transactionType: 'RTGS',
    transactionDate: '2099-01-01', transactionReference: 'REF1', accountNumber: '9876543210123', accountName: 'Alice',
    swiftCode: 'INZAZMLUXXX', sortCode: '040002', physicalAddress: { plotNo: '10', streetName: 'Cairo Road', town: 'Lusaka' }, remarks: 'Supplier payment' };
  const queues = new Map([['original', { queueId: 'original', paymentId: payment.paymentId, bankCode: bank, sourceBank: 'SOURCE1',
    status, paymentPayload: JSON.stringify(payment), responsePayload: JSON.stringify({ recovery: { protocol: 'zanaco-recovery-v1', ...evidence } }) }]]);
  const actions = new Map();
  const reservation = { queueId: 'original', update: async function (values) { Object.assign(this, values); } };
  const h2h = { queueId: 'original', state: status, leaseUntil: null, document: JSON.stringify({ payment, ...evidence, notSentReason: evidence.notSent ? 'authentication' : undefined }) };
  let tail = Promise.resolve();
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const db = { transaction: fn => {
    const run = async () => {
      const snapshot = [new Map(queues), new Map(actions), reservation.queueId];
      try { return await fn(transaction); }
      catch (error) {
        queues.clear(); snapshot[0].forEach((value, key) => queues.set(key, value));
        actions.clear(); snapshot[1].forEach((value, key) => actions.set(key, value)); reservation.queueId = snapshot[2];
        throw error;
      }
    };
    const result = tail.then(run, run); tail = result.catch(() => {}); return result;
  } };
  const matches = (value, where) => Object.entries(where || {}).every(([key, expected]) => value[key] === expected);
  const queueModel = {
    findOne: async ({ where }) => [...queues.values()].find(row => matches(row, where)),
    create: async row => { queues.set(row.queueId, row); return row; },
  };
  const actionModel = {
    findByPk: async key => actions.get(key),
    findOne: async ({ where }) => [...actions.values()].find(row => matches(row, where)),
    findAll: async ({ where }) => [...actions.values()].filter(row => matches(row, where)),
    create: async values => {
      const row = { ...values, get: key => key === 'createdAt' ? new Date() : undefined, save: async () => {} };
      actions.set(row.actionId, row); return row;
    },
  };
  const source = { accountNumber: '1234567890123', transit: '001', name: 'IDC' };
  const ledger = {
    documentOf: row => JSON.parse(row.document),
    recoverH2hInstruction: async () => {},
    createH2hRecoveryAttempt: async (row, sourceBank, recoveryOf) => {
      const queueId = 'new-h2h-instruction';
      await queueModel.create({ queueId, paymentId: row.paymentId, bankCode: bank, sourceBank, status: 'queued', paymentPayload: JSON.stringify({ ...row, recoveryOf }) });
      return queueId;
    },
  };
  const core = load('idcbanksinegration/app/lib/paymentRecovery.ts', {
    './db': { connectDatabase: async () => {}, getSequelize: async () => db },
    '@/app/models/internal/PaymentQueueRequest': { PaymentQueueRequest: queueModel },
    '@/app/models/internal/PaymentRecoveryAction': { PaymentRecoveryAction: actionModel },
    '@/app/models/internal/ZicbH2hPayment': { PaymentDispatchReservation: { findOne: async () => reservation }, ZicbH2hPayment: { findByPk: async () => h2h } },
    './zicb/ledger': ledger,
    './sourceAccounts': { resolveSourceBank: async () => source },
    './banks/payloadBuilders': builders,
    './paymentRecoveryPolicy': policy,
    './bankRegistry': { assertBankAcceptsPayments: async () => { if (!bankEnabled) throw new Error('Bank not enabled'); } },
    './zicb/config': { sourceProfile: () => ({ profileId: 'test', regionCode: '101', currency: 'ZMW', amountScale: 2, channels: ['RTGS'] }) },
  });
  const forbidden = { denied: true, status: 403 };
  const route = load('idcbanksinegration/app/api/v1/payment_recovery/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    '@/app/lib/rbac': { requirePermission: async (_, permission) => role === 'VIEWER' || (permission === 'payments:retry' && role !== 'ADMIN') ? forbidden : { username: 'tester' }, isAuthError: result => result.denied === true },
    '@/app/lib/permissions': { PERMISSIONS: { QUEUES_READ: 'queues:read', PAYMENTS_POST: 'payments:post', PAYMENTS_RETRY: 'payments:retry' } },
    '@/app/lib/paymentRecovery': core,
    '@/app/models/internal/PaymentQueueRequest': { PaymentQueueRequest: queueModel },
    '@/app/lib/bankQueue': { enqueuePayment: (_, payment, queueId) => ({ id: queueId }) },
    '@/app/lib/bankIntegrations': { getBankIntegration: () => ({ dispatchStrategy: 'agent-pull' }) },
  });
  const input = { queueId: 'original', action: 'new_attempt', actionId: id, reason: 'Bank confirmed rejection REF123', confirmed: true,
    corrections: { accountName: 'Corrected Name' }, username: 'tester' };
  return { core, queues, actions, reservation, payment, h2h, input, post: body => route.POST({ json: async () => body }) };
}

test('disabled banks block corrected new submissions but allow status recovery on existing instructions', async () => {
  for (const bank of ['ZANACO', 'ZICB']) {
    const f = fixture({ bank, bankEnabled: false });
    await assert.rejects(f.core.requestPaymentRecovery(f.input), /not enabled/);
    assert.equal(f.queues.size, 1);
    const pending = fixture({ bank, status: 'unknown', bankEnabled: false });
    await pending.core.requestPaymentRecovery({ ...pending.input, action: 'check_status' });
    assert.equal(pending.queues.size, 1);
  }
});

test('new attempts preserve the original, amount/currency and audit trail for both banks', async () => {
  for (const bank of ['ZANACO', 'ZICB']) {
    const f = fixture({ bank });
    const original = JSON.stringify(f.queues.get('original'));
    const result = await f.core.requestPaymentRecovery(f.input);
    assert.equal(f.queues.size, 2);
    assert.equal(JSON.stringify(f.queues.get('original')), original);
    assert.equal(f.reservation.queueId, result.queueId);
    const payment = JSON.parse(f.queues.get(result.queueId).paymentPayload);
    assert.equal(payment.paymentId, 'SAGE1'); assert.equal(payment.amount, 10); assert.equal(payment.currency, 'ZMW');
    assert.equal(payment.accountName, 'Corrected Name'); assert.equal(payment.recoveryOf, 'original');
    assert.equal(f.actions.get(id).requestedBy, 'tester');
    assert.equal(f.actions.get(id).reason, f.input.reason);
    if (bank === 'ZANACO') {
      const previous = builders.buildZanacoPayload(f.payment, 'RTGS', { accountNumber: '1234567890123' });
      assert.notEqual(builders.buildZanacoPayload(payment, 'RTGS', { accountNumber: '1234567890123' }).request.externalTranRef, previous.request.externalTranRef);
    }
  }
});

test('duplicate clicks are idempotent and concurrent different requests cannot create two successors', async () => {
  const f = fixture();
  const results = await Promise.all([f.core.requestPaymentRecovery(f.input), f.core.requestPaymentRecovery(f.input)]);
  assert.equal(results[0].queueId, results[1].queueId); assert.equal(f.queues.size, 2); assert.equal(f.actions.size, 1);
  await assert.rejects(f.core.requestPaymentRecovery({ ...f.input, actionId: otherId }), /successor/);
  assert.equal(f.queues.size, 2);
});

test('unknown, paid and legacy failures are blocked even when the error text says authentication failed', async () => {
  for (const options of [{ status: 'unknown' }, { status: 'paid' }, { evidence: {} }]) {
    const f = fixture(options);
    f.queues.get('original').lastError = 'Authentication failed before submission';
    await assert.rejects(f.core.requestPaymentRecovery(f.input), /not permitted/);
    assert.equal(f.queues.size, 1); assert.equal(f.actions.size, 0);
  }
});

test('financial fields, invalid corrections and unconfirmed requests are rejected without a new instruction', async () => {
  for (const change of [{ corrections: { amount: 999 } }, { corrections: { accountNumber: '1'.repeat(21) } }, { confirmed: false }, { reason: '' }]) {
    const f = fixture();
    await assert.rejects(f.core.requestPaymentRecovery({ ...f.input, ...change }));
    assert.equal(f.queues.size, 1); assert.equal(f.actions.size, 0); assert.equal(f.reservation.queueId, 'original');
  }
});

test('operators can request status recovery but only administrators can create new attempts', async () => {
  for (const role of ['OPERATOR', 'VIEWER']) {
    const f = fixture({ role });
    assert.equal((await f.post(f.input)).status, 403); assert.equal(f.queues.size, 1);
  }
  const f = fixture({ role: 'OPERATOR', status: 'unknown', evidence: {} });
  const response = await f.post({ ...f.input, action: 'check_status' });
  assert.equal(response.status, 202); assert.equal(f.actions.get(id).status, 'pending');
  assert.equal(f.queues.size, 1);
  await assert.rejects(f.core.requestPaymentRecovery({ ...f.input, action: 'check_status', actionId: otherId }), /already pending/);
});
