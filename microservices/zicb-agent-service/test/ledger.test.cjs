const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Exercise the real ledger orchestration with a transactional in-memory adapter.
// These tests do not claim to validate MySQL/SQL Server locking behavior.
function fixture() {
  const payments = new Map(), events = new Map(), reservations = new Map(), queue = new Map(), sequences = new Map();
  const unique = () => Object.assign(new Error('duplicate'), { name: 'SequelizeUniqueConstraintError' });
  const ops = { lte: Symbol('lte'), or: Symbol('or'), and: Symbol('and'), in: Symbol('in') };
  const matches = (row, where) => Reflect.ownKeys(where).every(key => {
    const value = where[key];
    if (key === ops.or) return value.some(condition => matches(row, condition));
    if (key === ops.and) return value.every(condition => matches(row, condition));
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if (ops.lte in value) return row[key] != null && new Date(row[key]) <= value[ops.lte];
      if (ops.in in value) return value[ops.in].includes(row[key]);
    }
    return row[key] === value;
  });
  const hydrate = data => Object.assign({ updatedAt: new Date() }, data, { save: async function () { this.updatedAt = new Date(); } });
  let tail = Promise.resolve();
  const db = { transaction: (...args) => {
    const run = async () => {
      const snapshots = [payments, events, reservations, queue, sequences].map(map => JSON.parse(JSON.stringify([...map])));
      try { return await args.at(-1)({ LOCK: { UPDATE: 'UPDATE' } }); }
      catch (error) {
        [payments, events, reservations, queue, sequences].forEach((map, i) => { map.clear(); snapshots[i].forEach(([k, v]) => map.set(k, i === 0 || i === 4 ? hydrate(v) : v)); });
        throw error;
      }
    };
    const pending = tail.then(run, run); tail = pending.catch(() => {}); return pending;
  } };
  const models = {
    ZicbPrcnSequence: {
      findOrCreate: async ({ where, defaults }) => { if (!sequences.has(where.year)) sequences.set(where.year, hydrate({ ...defaults })); },
      findByPk: async year => sequences.get(year),
    },
    ZicbH2hPayment: {
      create: async data => { if ([...payments.values()].some(row => row.paymentKey === data.paymentKey)) throw unique(); const row = hydrate({ leaseToken: null, leaseUntil: null, ...data }); payments.set(data.queueId, row); return row; },
      findByPk: async id => payments.get(id),
      findOne: async ({ where }) => [...payments.values()].find(row => matches(row, where)),
    },
    ZicbH2hEvent: { create: async data => { if (events.has(data.eventId)) throw unique(); events.set(data.eventId, data); }, findByPk: async id => events.get(id) },
    PaymentDispatchReservation: { create: async data => { if (reservations.has(data.paymentKey)) throw unique(); reservations.set(data.paymentKey, data); } },
  };
  const mocks = {
    'sequelize': { Op: ops, Transaction: { ISOLATION_LEVELS: { READ_COMMITTED: 'READ COMMITTED' } } },
    '../db': { connectDatabase: async () => {}, getSequelize: async () => db },
    '@/app/models/internal/ZicbH2hPayment': models,
    '@/app/models/internal/PaymentQueueRequest': { PaymentQueueRequest: { create: async data => queue.set(data.queueId, data), update: async (data, options) => Object.assign(queue.get(options.where.queueId), data) } },
    '../paymentPostGuard': { findExistingPaymentPost: async () => null },
    './config': { sourceProfile: () => ({ profileId: 'test', currency: 'ZMW', regionCode: 'TEST', amountScale: 2, channels: ['RTGS', 'DDACC', 'INTERNAL'], cashbookAccount: '4000' }), reconcileDelay: () => 60000 },
  };
  const filename = path.resolve(__dirname, '../../../idcbanksinegration/app/lib/zicb/ledger.ts');
  const module = new Module(filename); module.filename = filename; module.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = module.require.bind(module);
  module.require = id => mocks[id] || original(id);
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
  const payment = { paymentId: 'SAGE-1', transactionType: 'RTGS', amount: 27.51, currency: 'ZMW', accountNumber: '0011223', accountName: 'Test', swiftCode: 'TESTZMLX', sortCode: '010001', transactionDate: '2026-09-07', remarks: 'Payment' };
  return { ledger: module.exports, payments, events, reservations, queue, sequences, payment };
}
test('accepted payments poll automatically, survive temporary failures, and update the queue without another submission', async () => {
  const f = fixture();
  const original = await f.ledger.enqueueH2h(f.payment, 'SOURCE');
  const submit = await f.ledger.claimH2hWork();
  assert.equal(submit.action, 'submit');
  await f.ledger.reportH2hWork(submit.queueId, submit.leaseToken, { state: 'accepted' });
  const row = f.payments.get(original.queueId);
  assert.equal(f.queue.get(row.queueId).status, 'accepted');
  assert.ok(new Date(row.nextRun).getTime() - Date.now() > 59000);
  assert.equal(await f.ledger.claimH2hWork(), null);
  for (const outcome of [
    { state: 'accepted', rawStatus: 'processing' },
    { state: 'unknown', error: 'Temporary bank status failure' },
    { state: 'accepted', rawStatus: 'processing' },
    { state: 'paid', bankRef: 'BANK-FINAL', rawStatus: 'completed' },
  ]) {
    row.nextRun = new Date(0);
    const poll = await f.ledger.claimH2hWork();
    assert.equal(poll.action, 'reconcile');
    assert.deepEqual(poll.batch, submit.batch);
    await f.ledger.reportH2hWork(poll.queueId, poll.leaseToken, outcome);
    assert.equal(f.queue.get(row.queueId).status, outcome.state);
  }
  assert.equal(JSON.parse(row.document).submissionAttempts, 1);
  const accounting = await f.ledger.claimH2hWork();
  assert.equal(accounting.action, 'accounting');
  await f.ledger.withAccountingLease(accounting.queueId, accounting.leaseToken, async () => ({ posted: true }));
  assert.equal(await f.ledger.claimH2hWork(), null);
  assert.equal(f.queue.get(row.queueId).status, 'paid');
});

test('manual accepted-payment status recovery immediately reconciles and applies the new bank outcome', async () => {
  const f = fixture();
  await f.ledger.enqueueH2h(f.payment, 'SOURCE');
  const submit = await f.ledger.claimH2hWork();
  await f.ledger.reportH2hWork(submit.queueId, submit.leaseToken, { state: 'accepted' });
  const row = f.payments.get(submit.queueId);
  row.nextRun = new Date(Date.now() + 7200000);
  await f.ledger.recoverH2hInstruction(row.queueId, 'check_status', { LOCK: { UPDATE: 'UPDATE' } });
  const poll = await f.ledger.claimH2hWork();
  assert.equal(poll.action, 'reconcile');
  assert.deepEqual(poll.batch, submit.batch);
  await f.ledger.reportH2hWork(poll.queueId, poll.leaseToken, { state: 'paid', bankRef: 'RECOVERED-BANK-REF', rawStatus: 'completed' });
  assert.equal(f.queue.get(row.queueId).status, 'paid');
  assert.equal(JSON.parse(f.queue.get(row.queueId).responsePayload).bankStatus, 'completed');
  assert.equal(JSON.parse(row.document).submissionAttempts, 1);
});

test('old accepted/unknown schedules are picked up after one interval without taking active leases', async () => {
  for (const state of ['accepted', 'unknown']) {
    const f = fixture();
    await f.ledger.enqueueH2h(f.payment, 'SOURCE');
    const submit = await f.ledger.claimH2hWork();
    await f.ledger.reportH2hWork(submit.queueId, submit.leaseToken, { state });
    const row = f.payments.get(submit.queueId);
    row.nextRun = new Date(Date.now() + 7200000);
    assert.equal(await f.ledger.claimH2hWork(), null);
    row.updatedAt = new Date(Date.now() - 61000);
    row.leaseUntil = new Date(Date.now() + 300000);
    assert.equal(await f.ledger.claimH2hWork(), null);
    row.leaseUntil = null;
    const results = await Promise.all([f.ledger.claimH2hWork(), f.ledger.claimH2hWork()]);
    const claimed = results.filter(Boolean);
    assert.equal(claimed.length, 1);
    assert.equal(claimed[0].action, 'reconcile');
    assert.equal(claimed[0].batch.reference, submit.batch.reference);
  }
});

test('automatic status failure stops polling and does not start accounting', async () => {
  const f = fixture();
  await f.ledger.enqueueH2h(f.payment, 'SOURCE');
  const submit = await f.ledger.claimH2hWork();
  await f.ledger.reportH2hWork(submit.queueId, submit.leaseToken, { state: 'accepted' });
  const row = f.payments.get(submit.queueId);
  row.nextRun = new Date(0);
  const poll = await f.ledger.claimH2hWork();
  await f.ledger.reportH2hWork(poll.queueId, poll.leaseToken, { state: 'failed', error: 'Bank confirmed failure' });
  assert.equal(f.queue.get(row.queueId).status, 'failed');
  assert.equal(row.nextRun, null);
  row.updatedAt = new Date(0);
  assert.equal(await f.ledger.claimH2hWork(), null);
});

test('annual PRCN counter allocates unique sequential references for concurrent payments', async () => {
  const f = fixture();
  const year = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Africa/Johannesburg' }).format(new Date()));
  f.sequences.set(year - 1, { lastValue: 99999 });
  const results = await Promise.all(Array.from({ length: 5 }, (_, index) => f.ledger.enqueueH2h({ ...f.payment, paymentId: `PAY-${index}` }, 'SOURCE')));
  assert.deepEqual(results.map(result => result.prcn_number), Array.from({ length: 5 }, (_, index) => `IDC-${year}-${String(index + 1).padStart(5, '0')}`));
  assert.equal(f.sequences.get(year).lastValue, 5);
  f.sequences.get(year).lastValue = 99999;
  await assert.rejects(() => f.ledger.enqueueH2h({ ...f.payment, paymentId: 'EXHAUSTED' }, 'SOURCE'), /sequence exhausted/);
  assert.equal(f.payments.size, 5);
  assert.equal(f.reservations.size, 5);
});

test('confirmed never-sent recovery requeues the original reference and refuses active or paid instructions', async () => {
  const f = fixture();
  await f.ledger.enqueueH2h(f.payment, 'SOURCE');
  const work = await f.ledger.claimH2hWork();
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const row = f.payments.get(work.queueId);
  row.state = 'unknown';
  await assert.rejects(() => f.ledger.recoverH2hInstruction(work.queueId, 'repost_not_sent', transaction), /still processing/);
  row.leaseUntil = null;
  await f.ledger.recoverH2hInstruction(work.queueId, 'repost_not_sent', transaction);
  assert.equal(row.state, 'queued');
  const next = await f.ledger.claimH2hWork();
  assert.equal(next.action, 'submit');
  assert.deepEqual(next.batch, work.batch);
  assert.equal(next.queueId, work.queueId);
  assert.ok([...f.events.values()].some(event => event.kind === 'operator_repost_not_sent'));
  row.state = 'paid'; row.leaseUntil = null;
  await assert.rejects(() => f.ledger.recoverH2hInstruction(work.queueId, 'repost_not_sent', transaction), /Only unresolved/);
});

test('concurrent submissions reserve one payment and commit one canonical queue record', async () => {
  const f = fixture();
  const results = await Promise.allSettled([f.ledger.enqueueH2h(f.payment, 'SOURCE'), f.ledger.enqueueH2h(f.payment, 'SOURCE')]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(f.payments.size, 1); assert.equal(f.queue.size, 1); assert.equal(f.reservations.size, 1);
  assert.match([...f.payments.values()][0].prcn, /^IDC-\d{4}-00001$/);
  assert.equal(JSON.parse([...f.queue.values()][0].paymentPayload).h2hProtocol, 'h2h-v1');
});

test('operator connection retry requires not-sent authentication proof and preserves the instruction reference', async () => {
  const f = fixture();
  await f.ledger.enqueueH2h(f.payment, 'SOURCE');
  const work = await f.ledger.claimH2hWork();
  await f.ledger.reportH2hWork(work.queueId, work.leaseToken, { state: 'rejected', notSent: true, notSentReason: 'authentication' });
  await f.ledger.recoverH2hInstruction(work.queueId, 'retry_connection', { LOCK: { UPDATE: 'UPDATE' } });
  const next = await f.ledger.claimH2hWork();
  assert.equal(next.action, 'submit');
  assert.equal(next.batch.reference, work.batch.reference);
  assert.equal(f.payments.size, 1);
});

test('operator status recovery of unknown payments only claims reconciliation', async () => {
  const f = fixture();
  await f.ledger.enqueueH2h(f.payment, 'SOURCE'); const work = await f.ledger.claimH2hWork();
  await f.ledger.reportH2hWork(work.queueId, work.leaseToken, { state: 'unknown' });
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  await assert.rejects(f.ledger.recoverH2hInstruction(work.queueId, 'retry_connection', transaction), /no recorded proof/);
  await f.ledger.recoverH2hInstruction(work.queueId, 'check_status', transaction);
  const next = await f.ledger.claimH2hWork();
  assert.equal(next.action, 'reconcile'); assert.equal(next.batch.reference, work.batch.reference);
});

test('active H2H leases cannot be overridden by portal controls', async () => {
  const f = fixture(); await f.ledger.enqueueH2h(f.payment, 'SOURCE'); const work = await f.ledger.claimH2hWork();
  await assert.rejects(f.ledger.recoverH2hInstruction(work.queueId, 'check_status', { LOCK: { UPDATE: 'UPDATE' } }), /still processing/);
});

test('corrected H2H attempts get new bank and accounting identities while preserving the original', async () => {
  const f = fixture(); const original = await f.ledger.enqueueH2h(f.payment, 'SOURCE');
  const before = JSON.stringify(f.payments.get(original.queueId));
  const next = await f.ledger.createH2hRecoveryAttempt({ ...f.payment, accountName: 'Corrected' }, 'SOURCE', original.queueId, { LOCK: { UPDATE: 'UPDATE' } });
  assert.equal(f.payments.size, 2); assert.equal(f.queue.size, 2);
  assert.equal(JSON.stringify(f.payments.get(original.queueId)), before);
  const row = f.payments.get(next), doc = JSON.parse(row.document);
  assert.notEqual(row.reference, original.reference); assert.notEqual(row.prcn, original.prcn_number);
  assert.match(row.prcn, /^IDC-\d{4}-00002$/);
  assert.equal(doc.payment.paymentId, f.payment.paymentId); assert.equal(doc.payment.amount, f.payment.amount);
  assert.equal(doc.recoveryOf, original.queueId);
});
test('expired submission lease becomes unknown and never claims another send', async () => {
  const f = fixture(); await f.ledger.enqueueH2h(f.payment, 'SOURCE');
  const first = await f.ledger.claimH2hWork(); assert.equal(first.action, 'submit');
  const row = f.payments.get(first.queueId); row.leaseUntil = new Date(0); row.nextRun = new Date(0);
  assert.equal(await f.ledger.claimH2hWork(), null); assert.equal(row.state, 'unknown');
  row.nextRun = new Date(0);
  const recovered = await f.ledger.claimH2hWork();
  assert.equal(recovered.action, 'reconcile'); assert.equal(recovered.batch.reference, first.batch.reference);
});
test('callback before submission report remains paid and schedules only accounting', async () => {
  const f = fixture(); await f.ledger.enqueueH2h(f.payment, 'SOURCE'); const work = await f.ledger.claimH2hWork();
  const callback = { reference: work.batch.reference, prcn_number: work.batch.transactions[0].prcn_number, status_code: 200, bankRef: 'BANK1' };
  await f.ledger.receiveH2hCallback('RTGS', callback);
  await f.ledger.reportH2hWork(work.queueId, work.leaseToken, { state: 'accepted' });
  assert.equal(f.payments.get(work.queueId).state, 'paid');
  const next = await f.ledger.claimH2hWork(); assert.equal(next.action, 'accounting');
  let amount;
  await f.ledger.withAccountingLease(next.queueId, next.leaseToken, async doc => { amount = doc.payment.amount; return { posted: true }; });
  assert.equal(amount, 27.51); assert.equal(JSON.parse(f.payments.get(work.queueId).document).accounting, 'posted');
});
test('duplicate callbacks and retried reports are durably deduplicated', async () => {
  const f = fixture(); await f.ledger.enqueueH2h(f.payment, 'SOURCE'); const work = await f.ledger.claimH2hWork();
  await f.ledger.reportH2hWork(work.queueId, work.leaseToken, { state: 'accepted' });
  const size = f.events.size;
  await f.ledger.reportH2hWork(work.queueId, work.leaseToken, { state: 'accepted' }); assert.equal(f.events.size, size);
  const body = { reference: work.batch.reference, prcn_number: work.batch.transactions[0].prcn_number, status_code: 200, bankRef: 'BANK1' };
  await f.ledger.receiveH2hCallback('RTGS', body);
  await assert.rejects(f.ledger.receiveH2hCallback('RTGS', body), error => error.status === 409);
  assert.equal(f.payments.get(work.queueId).state, 'paid');
});
test('conflicting outcomes hold the payment for review and prevent accounting', async () => {
  const f = fixture(); await f.ledger.enqueueH2h(f.payment, 'SOURCE'); const work = await f.ledger.claimH2hWork();
  const body = { reference: work.batch.reference, prcn_number: work.batch.transactions[0].prcn_number, status_code: 200, bankRef: 'BANK1' };
  await f.ledger.receiveH2hCallback('RTGS', body);
  await f.ledger.receiveH2hCallback('RTGS', { ...body, status_code: 400, bankRef: '' });
  assert.equal(f.payments.get(work.queueId).state, 'needs_review'); assert.equal(await f.ledger.claimH2hWork(), null);
});
test('accounting failure preserves paid state and retries accounting with canonical data', async () => {
  const f = fixture(); await f.ledger.enqueueH2h(f.payment, 'SOURCE'); const send = await f.ledger.claimH2hWork();
  await f.ledger.reportH2hWork(send.queueId, send.leaseToken, { state: 'accepted' });
  await f.ledger.receiveH2hCallback('RTGS', { reference: send.batch.reference, prcn_number: send.batch.transactions[0].prcn_number, status_code: 200, bankRef: 'BANK1' });
  const first = await f.ledger.claimH2hWork();
  await f.ledger.withAccountingLease(first.queueId, first.leaseToken, async () => { throw new Error('Sage offline'); });
  const row = f.payments.get(send.queueId); assert.equal(row.state, 'paid'); assert.equal(JSON.parse(row.document).accounting, 'retry');
  row.nextRun = new Date(0); assert.equal((await f.ledger.claimH2hWork()).action, 'accounting');
});

test('operator recovery of a paid item retries accounting only and refuses a second bank send', async () => {
  const f = fixture(); await f.ledger.enqueueH2h(f.payment, 'SOURCE');
  const send = await f.ledger.claimH2hWork();
  await f.ledger.reportH2hWork(send.queueId, send.leaseToken, { state: 'accepted' });
  await f.ledger.receiveH2hCallback('RTGS', { reference: send.batch.reference, prcn_number: send.batch.transactions[0].prcn_number, status_code: 200, bankRef: 'BANK-PAID' });
  const accounting = await f.ledger.claimH2hWork();
  await f.ledger.withAccountingLease(accounting.queueId, accounting.leaseToken, async () => ({ posted: false, review: true, error: 'Cashbook configuration needs review' }));
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  await assert.rejects(f.ledger.recoverH2hInstruction(send.queueId, 'retry_connection', transaction));
  await assert.rejects(f.ledger.recoverH2hInstruction(send.queueId, 'check_status', transaction));
  await f.ledger.recoverH2hInstruction(send.queueId, 'retry_accounting', transaction);
  const next = await f.ledger.claimH2hWork();
  assert.equal(next.action, 'accounting');
  assert.equal(next.batch.reference, send.batch.reference);
  await f.ledger.withAccountingLease(next.queueId, next.leaseToken, async () => ({ posted: true }));
  assert.equal(f.payments.get(send.queueId).state, 'paid');
  await assert.rejects(f.ledger.recoverH2hInstruction(send.queueId, 'retry_accounting', transaction));
});
