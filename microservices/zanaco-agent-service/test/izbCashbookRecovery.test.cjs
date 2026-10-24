const test = require('node:test');
const assert = require('node:assert/strict');
const { load, routeFixture } = require('./helpers/portal.cjs');
const root = 'idcbanksinegration/app/';
const contract = load(root + 'lib/cashbookContract.ts');
const policy = load(root + 'lib/sageQueryPolicy.ts');
const Op = { in: Symbol('in'), or: Symbol('or'), like: Symbol('like') };

function fixture({ status = 'failed', bank = 'IZB', missing = false, duplicate = false, sageExisting = false, fail = false, bankRace = false } = {}) {
  const notification = { transactionId: 'IDC8A24F91C0', bankCode: 'IZB', description: 'Jason Songwe',
    noEntries: 1, creditAmount: 5000, debitAmount: 5000, entries: [{ entryNo: 1, referenceNo: 'IDC8A24F91C0', customerNo: 'PK-0034-IDC',
      noDetails: 1, amount: 5000, currency: 'ZMW', details: [{ entryDescription: 'Jason Songwe', accountId: 'GL-TEST', amount: 5000, DrCr: 'Cr', detailNo: 1 }] }] };
  const audit = [], writes = [], processed = new Map(), receipts = [], sageHeaders = new Map();
  const queue = { id: 1, queueId: 'original', bankCode: bank, paymentId: notification.transactionId, status: 'failed',
    paymentPayload: JSON.stringify({ paymentId: notification.transactionId, amount: 5000, currency: 'ZMW' }) };
  let failSage = fail, tail = Promise.resolve(), claimed = 0, inTransaction = false;
  const hydrateReceipt = row => ({ ...row, update: async values => { Object.assign(row, values); } });
  if (!missing) receipts.push({ id: 1, transactionId: notification.transactionId, bankCode: 'IZB', status,
    paymentPayload: JSON.stringify(notification), debitAmount: 5000, statusMessage: 'Previous failure' });
  if (duplicate) receipts.push({ ...receipts[0], id: 2 });
  if (sageExisting) sageHeaders.set(notification.transactionId, { batchid: '000123' });
  const receiptModel = {
    findAll: async ({ where }) => receipts.filter(row => row.bankCode === where.bankCode && where.transactionId[Op.in].includes(row.transactionId)).map(hydrateReceipt),
    findOne: async ({ where }) => { const row = receipts.find(row => row.transactionId === where.transactionId); return row ? hydrateReceipt(row) : null; },
    create: async values => { const row = { id: receipts.length + 1, ...values }; receipts.push(row); return hydrateReceipt(row); },
    update: async (values, { where }) => {
      const row = receipts.find(row => row.id === where.id && row.status === where.status && row.bankCode === where.bankCode);
      if (!row) return [0];
      claimed++; Object.assign(row, values); return [1];
    },
  };
  const queueModel = {
    findOne: async ({ where }) => where.queueId === queue.queueId ? queue : null,
    findAll: async options => { assert.equal(options.limit, undefined, 'old queue entries remain matchable'); return [queue]; },
    update: async values => { Object.assign(queue, values); return [1]; },
  };
  const processedModel = {
    findByPk: async id => processed.get(id),
    create: async values => { const row = { ...values, save: async () => {} }; processed.set(row.transactionId, row); return row; },
  };
  const sage = {
    models: {},
    query: async (sql, options) => {
      policy.assertSageQueryAllowed(sql);
      if (sql === policy.SAGE_CASHBOOK_LOCK_SQL) { assert.ok(options.transaction); return [[{ lockResult: 0 }]]; }
      return [[{ IDCUST: 'PK-0034-IDC', NAMECUST: 'Jason Songwe' }]];
    },
    transaction: fn => {
      const run = async () => {
        const previous = new Map(sageHeaders), count = writes.length;
        inTransaction = true;
        try {
          const result = await fn({});
          if (failSage) throw new Error('Sage unavailable');
          return result;
        } catch (error) { sageHeaders.clear(); previous.forEach((value, key) => sageHeaders.set(key, value)); writes.length = count; throw error; }
        finally { inTransaction = false; }
      };
      const result = tail.then(run, run); tail = result.catch(() => {}); return result;
    },
  };
  let prechecks = 0;
  const headers = {
    findOne: async ({ where, transaction }) => {
      if (!transaction) {
        prechecks++;
        // Simulate another callback committing after the early check. The
        // authoritative in-transaction check must see it and skip all inserts.
        if (bankRace && prechecks === 1) { sageHeaders.set(where.reference, { batchid: '000124' }); return null; }
      }
      const row = sageHeaders.get(where.reference);
      return row ? { get: key => row[key] } : null;
    },
    create: async values => { assert.ok(inTransaction); writes.push({ model: 'header', ...values }); sageHeaders.set(values.reference, values); },
  };
  const coreMocks = {
    sequelize: { Op, Transaction: {} },
    '@/app/lib/db': { connectDatabase: async () => {} },
    '@/app/lib/sageDb': { __esModule: true, default: sage, connectSageDatabase: async () => {} },
    '@/app/lib/sageQueryPolicy': policy,
    '@/app/models/internal/CashbookReceipt': { CashbookReceipt: receiptModel },
    '@/app/models/internal/Processed_transactions': { ProcessedTransaction: processedModel },
    '@/app/models/internal/PaymentQueueRequest': { PaymentQueueRequest: queueModel },
    '@/app/models/sage_entities/Cbbthd': { Cbbthd: headers },
    '@/app/models/sage_entities/Cbbctl': { Cbbctl: { findOne: async () => null, create: async values => writes.push({ model: 'batch', ...values }) } },
    '@/app/models/sage_entities/Cbbtdt': { Cbbtdt: { create: async values => writes.push({ model: 'detail', ...values }) } },
    '@/app/models/sage_entities/Cbbtm': { Cbbtm: { create: async () => {} } },
    '@/app/models/sage_entities/Cboptio': { Cboptio: { findOne: async () => null } },
    '@/app/models/sage_entities/Arcus': { Arcus: {} },
  };
  const core = load(root + 'lib/cashbookService.ts', coreMocks);
  const recovery = load(root + 'lib/izbCashbookRecovery.ts', {
    sequelize: { Op }, './db': { connectDatabase: async () => {} },
    '@/app/models/internal/PaymentQueueRequest': { PaymentQueueRequest: queueModel },
    '@/app/models/internal/CashbookReceipt': { CashbookReceipt: receiptModel },
    './cashbookContract': contract, './cashbookService': core,
  });
  let allowed = true;
  const route = load(root + 'api/v1/izb/cashbook_recovery/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    '@/app/lib/rbac': { requirePermission: async (_req, permission) => {
      assert.equal(permission, 'cashbook:post'); return allowed ? { id: 1, username: 'operator' } : { denied: true, status: 403 };
    }, isAuthError: value => value.denied === true },
    '@/app/lib/permissions': { PERMISSIONS: { CASHBOOK_POST: 'cashbook:post' } },
    '@/app/lib/izbCashbookRecovery': recovery,
    '@/app/lib/auditLog': { logAuditEvent: async value => audit.push(value) },
  });
  return { notification, queue, receipts, writes, audit, recovery, core, sageHeaders, processed, claimed: () => claimed,
    setFailure: value => { failSage = value; }, deny: () => { allowed = false; },
    post: body => route.POST({ json: async () => body || { queueId: 'original', reason: 'Sage connectivity restored' } }) };
}

test('IZB retry immediately posts the saved notification and records the operator without altering financial fields', async () => {
  const f = fixture();
  const before = f.receipts[0].paymentPayload;
  const response = await f.post();
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(f.receipts[0].paymentPayload, before);
  assert.equal(f.queue.status, 'success');
  assert.equal(f.receipts[0].status, 'success');
  const header = f.writes.find(row => row.model === 'header'), detail = f.writes.find(row => row.model === 'detail');
  assert.equal(header.reference, f.notification.transactionId);
  assert.equal(header.totamount, 5000);
  assert.equal(detail.acctid, 'GL-TEST');
  assert.equal(f.audit[0].action, 'CASHBOOK_RETRY_REQUESTED');
  assert.equal(f.audit[0].username, 'operator');
  assert.equal(f.audit.at(-1).action, 'SAGE_CASHBOOK_SUCCESS');
});

test('a failed retry can be retried again immediately after correcting Sage connectivity', async () => {
  const f = fixture({ fail: true });
  assert.equal((await f.post()).status, 502);
  assert.equal(f.receipts[0].status, 'failed');
  assert.equal(f.writes.length, 0, 'Sage transaction rolled back');
  f.setFailure(false);
  assert.equal((await f.post()).status, 200);
  assert.equal(f.receipts[0].status, 'success');
  assert.equal(f.claimed(), 2);
});

test('concurrent retries and bank callbacks cannot create duplicate Sage cashbook entries', async () => {
  const f = fixture();
  const results = await Promise.allSettled([
    f.recovery.retryIzbCashbook('original'), f.recovery.retryIzbCashbook('original'), f.core.processCashbookReceipt(f.notification),
  ]);
  assert.ok(results.some(result => result.status === 'fulfilled'));
  assert.equal(f.claimed(), 1);
  assert.equal(f.writes.filter(row => row.model === 'header').length, 1);
  assert.equal(f.receipts[0].status, 'success');
});

test('existing Sage references reconcile local success even when the original commit response was lost', async () => {
  for (const options of [{ sageExisting: true }, { bankRace: true }]) {
    const f = fixture(options);
    assert.equal((await f.post()).status, 200);
    assert.equal(f.writes.length, 0);
    assert.equal(f.receipts[0].status, 'success');
    assert.equal(f.queue.status, 'success');
  }
});

test('saved success repairs a stale failed receipt and queue without repeating Sage writes', async () => {
  const f = fixture();
  f.processed.set(f.notification.transactionId, { statusCode: 200, statusMessage: 'Already posted', save: async () => {} });
  assert.equal((await f.post()).status, 200);
  assert.equal(f.writes.length, 0);
  assert.equal(f.receipts[0].status, 'success');
  assert.equal(f.queue.status, 'success');
});

test('missing, ambiguous, invalid, completed or active notifications and other banks cannot be retried', async () => {
  for (const options of [{ missing: true }, { duplicate: true }, { status: 'success' }, { status: 'pending' }, { status: 'processing' }, { bank: 'ZICB' }]) {
    const f = fixture(options);
    assert.ok((await f.post()).status >= 400, JSON.stringify(options));
    assert.equal(f.writes.length, 0);
  }
  const f = fixture();
  f.receipts[0].paymentPayload = JSON.stringify({ ...f.notification, transactionId: 'DIFFERENT' });
  assert.equal((await f.post()).status, 409);
  assert.equal(f.writes.length, 0);
});

test('cashbook recovery requires permission and a reason, and rejects attempts to edit saved payment data', async () => {
  const f = fixture();
  for (const body of [
    { queueId: 'original', reason: 'short' },
    { queueId: 'original', reason: 'Approved cashbook recovery', amount: 1 },
    { queueId: 'original', reason: 'Approved cashbook recovery', accountId: 'OTHER' },
  ]) assert.equal((await f.post(body)).status, 400);
  f.deny();
  assert.equal((await f.post()).status, 403);
  assert.equal(f.writes.length, 0);
});

test('ordinary posting cannot turn an existing IZB failure back into a bank payment', async () => {
  const f = routeFixture({ retry: true });
  const result = await f.post({ bankCode: 'IZB', sourceBank: 'SOURCE1', payment: {
    paymentId: 'IDC8A24F91C0', accountNumber: '1234567890123', amount: 5000, currency: 'ZMW', transactionType: 'INT',
  } });
  assert.equal(result.status, 409, JSON.stringify(result.body));
  assert.equal(result.body.recoveryRequired, true);
  assert.equal(f.updates.length, 0);
  assert.equal(f.records.length, 0);
});
