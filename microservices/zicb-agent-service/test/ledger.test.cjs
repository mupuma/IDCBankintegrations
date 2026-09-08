const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Exercise the real ledger orchestration with a transactional in-memory adapter.
// These tests do not claim to validate MySQL/SQL Server locking behavior.
function fixture() {
  const payments = new Map(), events = new Map(), reservations = new Map(), queue = new Map();
  const unique = () => Object.assign(new Error('duplicate'), { name: 'SequelizeUniqueConstraintError' });
  const hydrate = data => Object.assign(data, { save: async () => {} });
  let tail = Promise.resolve();
  const db = { transaction: (...args) => {
    const run = async () => {
      const snapshots = [payments, events, reservations, queue].map(map => JSON.parse(JSON.stringify([...map])));
      try { return await args.at(-1)({ LOCK: { UPDATE: 'UPDATE' } }); }
      catch (error) {
        [payments, events, reservations, queue].forEach((map, i) => { map.clear(); snapshots[i].forEach(([k, v]) => map.set(k, i === 0 ? hydrate(v) : v)); });
        throw error;
      }
    };
    const pending = tail.then(run, run); tail = pending.catch(() => {}); return pending;
  } };
  const models = {
    ZicbH2hPayment: {
      create: async data => { if ([...payments.values()].some(row => row.paymentKey === data.paymentKey)) throw unique(); const row = hydrate({ leaseToken: null, leaseUntil: null, ...data }); payments.set(data.queueId, row); return row; },
      findByPk: async id => payments.get(id),
      findOne: async ({ where }) => [...payments.values()].find(row => where.reference
        ? row.reference === where.reference && row.prcn === where.prcn && row.channel === where.channel
        : row.nextRun && new Date(row.nextRun) <= new Date() && (!row.leaseUntil || new Date(row.leaseUntil) <= new Date())),
    },
    ZicbH2hEvent: { create: async data => { if (events.has(data.eventId)) throw unique(); events.set(data.eventId, data); }, findByPk: async id => events.get(id) },
    PaymentDispatchReservation: { create: async data => { if (reservations.has(data.paymentKey)) throw unique(); reservations.set(data.paymentKey, data); } },
  };
  const mocks = {
    '../db': { connectDatabase: async () => {}, getSequelize: async () => db },
    '@/app/models/internal/ZicbH2hPayment': models,
    '@/app/models/internal/PaymentQueueRequest': { PaymentQueueRequest: { create: async data => queue.set(data.queueId, data), update: async (data, options) => Object.assign(queue.get(options.where.queueId), data) } },
    '../paymentPostGuard': { findExistingPaymentPost: async () => null },
    './config': { sourceProfile: () => ({ profileId: 'test', currency: 'ZMW', regionCode: 'TEST', amountScale: 2, channels: ['RTGS', 'DDACC', 'INTERNAL'], cashbookAccount: '4000' }), reconcileDelay: () => 7200000 },
  };
  const filename = path.resolve(__dirname, '../../../idcbanksinegration/app/lib/zicb/ledger.ts');
  const module = new Module(filename); module.filename = filename; module.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = module.require.bind(module);
  module.require = id => mocks[id] || original(id);
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
  const payment = { paymentId: 'SAGE-1', transactionType: 'RTGS', amount: 27.51, currency: 'ZMW', accountNumber: '0011223', accountName: 'Test', swiftCode: 'TESTZMLX', sortCode: '010001', transactionDate: '2026-09-07', remarks: 'Payment' };
  return { ledger: module.exports, payments, events, reservations, queue, payment };
}
test('concurrent submissions reserve one payment and commit one canonical queue record', async () => {
  const f = fixture();
  const results = await Promise.allSettled([f.ledger.enqueueH2h(f.payment, 'SOURCE'), f.ledger.enqueueH2h(f.payment, 'SOURCE')]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(f.payments.size, 1); assert.equal(f.queue.size, 1); assert.equal(f.reservations.size, 1);
  assert.equal(JSON.parse([...f.queue.values()][0].paymentPayload).h2hProtocol, 'h2h-v1');
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
