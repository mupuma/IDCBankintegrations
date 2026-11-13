const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { load, builders } = require('./helpers/portal.cjs');
const policy = load('idcbanksinegration/app/lib/paymentRecoveryPolicy.ts');
const permissions = load('idcbanksinegration/app/lib/permissions.ts');
const id = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';

function fixture({ bank = 'ZANACO', status = 'failed', evidence = { confirmedRejected: true }, role = 'OPERATOR' } = {}) {
  const payment = { paymentId: 'SAGE1', amount: 10, currency: 'ZMW', transactionType: 'RTGS',
    transactionDate: '2099-01-01', transactionReference: 'REF1', accountNumber: '9876543210123', accountName: 'Alice',
    swiftCode: 'INZAZMLUXXX', sortCode: '040002', physicalAddress: { plotNo: '10', streetName: 'Cairo Road', town: 'Lusaka' }, remarks: 'Supplier payment' };
  const queues = new Map([['original', { queueId: 'original', paymentId: payment.paymentId, bankCode: bank, sourceBank: 'SOURCE1',
    status, paymentPayload: JSON.stringify(payment), responsePayload: JSON.stringify(bank === 'IZB' ? { protocol: 'izb-bank-status-v1', bankStatus: 'failed', eventId: 'IZB-FAIL-1' } : { recovery: { protocol: 'zanaco-recovery-v1', ...evidence } }) }]]);
  const actions = new Map(), audits = [];
  let failAudit = false;
  const reservation = { queueId: 'original', update: async function (values) { Object.assign(this, values); } };
  const h2h = { queueId: 'original', state: status, leaseUntil: null, document: JSON.stringify({ payment, ...evidence, notSentReason: evidence.notSent ? 'authentication' : undefined }) };
  let tail = Promise.resolve();
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const db = { transaction: fn => {
    const run = async () => {
      const snapshot = [new Map(queues), new Map(actions), reservation.queueId, audits.length];
      try { return await fn(transaction); }
      catch (error) {
        queues.clear(); snapshot[0].forEach((value, key) => queues.set(key, value));
        actions.clear(); snapshot[1].forEach((value, key) => actions.set(key, value)); reservation.queueId = snapshot[2]; audits.length = snapshot[3];
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
    findOne: async ({ where }) => [...actions.values()].reverse().find(row => matches(row, where)),
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
    'sequelize': { Op: { or: Symbol('or'), lte: Symbol('lte'), like: Symbol('like') } },
    './db': { connectDatabase: async () => {}, getSequelize: async () => db },
    '@/app/models/internal/PaymentQueueRequest': { PaymentQueueRequest: queueModel },
    '@/app/models/internal/AuditLog': { AuditLog: { create: async (values, options) => { assert.equal(options.transaction, transaction); if (failAudit) throw new Error('Audit unavailable'); audits.push(values); } } },
    '@/app/models/internal/PaymentRecoveryAction': { PaymentRecoveryAction: actionModel },
    '@/app/models/internal/ZicbH2hPayment': { PaymentDispatchReservation: { findOne: async () => reservation }, ZicbH2hPayment: { findByPk: async () => h2h } },
    './zicb/ledger': ledger,
    './sourceAccounts': { resolveSourceBank: async () => source },
    './banks/payloadBuilders': builders,
    './paymentRecoveryPolicy': policy,
    './zicb/config': { sourceProfile: () => ({ profileId: 'test', regionCode: '101', currency: 'ZMW', amountScale: 2, channels: ['RTGS'] }) },
  });
  const forbidden = { denied: true, status: 403 };
  const route = load('idcbanksinegration/app/api/v1/payment_recovery/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    '@/app/lib/rbac': { requirePermission: async (_, permission) => !permissions.roleHasPermission(role, permission) ? forbidden : { username: 'tester', id: 10 }, isAuthError: result => result.denied === true },
    '@/app/lib/permissions': permissions,
    '@/app/lib/paymentRecovery': core,
    '@/app/models/internal/PaymentQueueRequest': { PaymentQueueRequest: queueModel },
    '@/app/lib/bankQueue': { enqueuePayment: (_, payment, queueId) => ({ id: queueId }) },
    '@/app/lib/bankIntegrations': { getBankIntegration: () => ({ dispatchStrategy: 'agent-pull' }) },
  });
  const input = { queueId: 'original', action: 'new_attempt', actionId: id, reason: 'Bank confirmed rejection REF123', confirmed: true,
    corrections: {}, username: 'tester' };
  return { core, queues, actions, audits, failAudit: () => { failAudit = true; }, reservation, payment, h2h, input, post: body => route.POST({ json: async () => body }) };
}

test('ZICB never-sent repost requires payment retry permission and explicit confirmation, and is audited idempotently', async () => {
  const input = { action: 'repost_not_sent', corrections: {}, confirmed: true };
  const restricted = fixture({ bank: 'ZICB', status: 'unknown', evidence: {}, role: 'BANK_DETAILS_MAKER' });
  assert.equal((await restricted.post({ ...restricted.input, ...input })).status, 403);
  const f = fixture({ bank: 'ZICB', status: 'unknown', evidence: {} });
  await assert.rejects(() => f.core.requestPaymentRecovery({ ...f.input, ...input, confirmed: false }), /Confirm/);
  const result = await f.core.requestPaymentRecovery({ ...f.input, ...input });
  assert.equal(result.isNewAction, true);
  assert.equal(f.queues.size, 1);
  assert.equal(f.actions.get(id).action, 'repost_not_sent');
  assert.equal(f.actions.get(id).reason, f.input.reason);
  assert.equal((await f.core.requestPaymentRecovery({ ...f.input, ...input })).isNewAction, false);
  f.reservation.queueId = 'successor';
  await assert.rejects(() => f.core.requestPaymentRecovery({ ...f.input, ...input, actionId: otherId }), /successor/);
});

test('new attempts preserve the original, amount/currency and audit trail for both banks', async () => {
  for (const bank of ['IZB', 'ZANACO', 'ZICB']) {
    const f = fixture({ bank });
    await f.core.requestPaymentRecovery({ ...f.input, action: 'edit_details', actionId: otherId, corrections: { accountName: 'Corrected Name' }, username: 'maker' });
    const original = JSON.stringify(f.queues.get('original'));
    const result = await f.core.requestPaymentRecovery({ ...f.input, correctionRevision: otherId });
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

test('operators can submit attempts and makers can edit, while viewers and administrators cannot submit', async () => {
  for (const role of ['BANK_DETAILS_MAKER', 'VIEWER', 'ADMIN']) {
    const f = fixture({ role });
    assert.equal((await f.post(f.input)).status, 403); assert.equal(f.queues.size, 1);
  }
  const f = fixture({ role: 'OPERATOR', status: 'unknown', evidence: {} });
  const response = await f.post({ ...f.input, action: 'check_status' });
  assert.equal(response.status, 202); assert.equal(f.actions.get(id).status, 'pending');
  assert.equal(f.queues.size, 1);
  await assert.rejects(f.core.requestPaymentRecovery({ ...f.input, action: 'check_status', actionId: otherId }), /already pending/);
});

test('makers save corrections without sending money and every changed field is recorded in the central audit log', async () => {
  const f = fixture({ role: 'BANK_DETAILS_MAKER' });
  const before = JSON.stringify(f.queues.get('original'));
  const response = await f.post({ ...f.input, action: 'edit_details', confirmed: false,
    corrections: { accountNumber: '0012345678901', branchCode: '001', physicalAddress: { town: 'Ndola' } } });
  assert.equal(response.status, 202, JSON.stringify(response.body));
  assert.equal(f.queues.size, 1); assert.equal(f.reservation.queueId, 'original');
  assert.equal(JSON.stringify(f.queues.get('original')), before);
  assert.equal(f.audits.length, 1);
  const audit = f.audits[0], details = JSON.parse(audit.details);
  assert.equal(audit.action, 'PAYMENT_DETAILS_UPDATED'); assert.equal(audit.userId, 10);
  assert.equal(audit.username, 'tester'); assert.equal(details.reason, f.input.reason);
  const accountChange = details.changes.find(change => change.field === 'accountNumber');
  assert.equal(accountChange.before, '9876543210123'); assert.equal(accountChange.after, '0012345678901');
  const saved = await f.core.getRecoveryDetails('original');
  assert.equal(saved.payment.accountNumber, '0012345678901');
  assert.equal(saved.payment.physicalAddress.town, 'Ndola');
  assert.equal(saved.payment.physicalAddress.streetName, 'Cairo Road');
  assert.equal(saved.correctionDraft.revision, id);
  assert.equal(saved.history[0].result.changes.length, 3);
});

test('operators cannot edit details and makers cannot submit; operators submit exactly the saved revision', async () => {
  const operator = fixture(), maker = fixture({ role: 'BANK_DETAILS_MAKER' });
  assert.equal((await operator.post({ ...operator.input, action: 'edit_details', corrections: { accountName: 'Changed' } })).status, 403);
  assert.equal((await maker.post(maker.input)).status, 403);
  assert.equal((await operator.post({ ...operator.input, corrections: { accountName: 'Bypass maker' } })).status, 403);
  assert.equal(operator.audits.length, 0);
  const f = fixture();
  await f.core.requestPaymentRecovery({ ...f.input, action: 'edit_details', corrections: { accountName: 'Corrected' }, username: 'maker' });
  await assert.rejects(f.core.requestPaymentRecovery({ ...f.input, actionId: otherId }), /details changed/);
  const result = await f.core.requestPaymentRecovery({ ...f.input, actionId: otherId, correctionRevision: id });
  const payment = JSON.parse(f.queues.get(result.queueId).paymentPayload);
  assert.equal(payment.accountName, 'Corrected'); assert.equal(payment.amount, f.payment.amount);
  assert.equal(f.audits[1].action, 'PAYMENT_CORRECTED_ATTEMPT');
  assert.equal(JSON.parse(f.audits[1].details).correctedBy, 'maker');
  assert.equal((await f.core.requestPaymentRecovery({ ...f.input, actionId: otherId, correctionRevision: id })).isNewAction, false);
  assert.equal(f.audits.length, 2, 'a replay does not duplicate audit entries');
});

test('audit storage failure rolls back saved corrections and successor instructions', async () => {
  for (const action of ['edit_details', 'new_attempt']) {
    const f = fixture(); f.failAudit();
    await assert.rejects(f.core.requestPaymentRecovery({ ...f.input, action, corrections: action === 'edit_details' ? { accountName: 'Changed' } : {} }), /Audit unavailable/);
    assert.equal(f.queues.size, 1); assert.equal(f.actions.size, 0); assert.equal(f.audits.length, 0);
    assert.equal(f.reservation.queueId, 'original');
  }
});

test('only confirmed failed canonical payments can be edited and stale concurrent corrections are rejected', async () => {
  for (const options of [{ status: 'paid' }, { status: 'unknown' }, { status: 'accepted' }, { evidence: {} }]) {
    const f = fixture(options);
    await assert.rejects(f.core.requestPaymentRecovery({ ...f.input, action: 'edit_details', corrections: { accountName: 'Changed' } }), /not permitted/);
    assert.equal(f.audits.length, 0);
  }
  const f = fixture();
  const results = await Promise.allSettled([
    f.core.requestPaymentRecovery({ ...f.input, action: 'edit_details', corrections: { accountName: 'First' } }),
    f.core.requestPaymentRecovery({ ...f.input, action: 'edit_details', actionId: otherId, corrections: { accountName: 'Second' } }),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(f.audits.length, 1); assert.equal(f.queues.size, 1);
  await assert.rejects(f.core.requestPaymentRecovery({ ...f.input, action: 'edit_details', actionId: otherId, corrections: { amount: 20 }, correctionRevision: id }), /Cannot change amount/);
});

test('IZB corrected attempts use a fresh bank reference while retaining the original Sage payment identity', async () => {
  const f = fixture({ bank: 'IZB' });
  const result = await f.core.requestPaymentRecovery(f.input);
  const successor = f.queues.get(result.queueId), payment = JSON.parse(successor.paymentPayload);
  assert.equal(successor.status, 'queued'); assert.equal(successor.bankCode, 'IZB');
  assert.equal(successor.paymentId, f.payment.paymentId);
  assert.match(payment.izbAttemptReference, /^IDC[A-Z0-9]{9}$/);
  assert.equal(payment.transactionId, payment.izbAttemptReference);
  assert.notEqual(payment.transactionId, f.payment.paymentId);
  assert.equal(f.queues.get('original').status, 'failed');
  assert.equal(f.reservation.queueId, successor.queueId);
});
