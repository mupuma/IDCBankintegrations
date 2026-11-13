const test = require('node:test');
const assert = require('node:assert/strict');
const { load, routeFixture } = require('./helpers/portal.cjs');
const root = 'idcbanksinegration/app/';
const contract = load(root + 'lib/cashbookContract.ts');
const policy = load(root + 'lib/sageQueryPolicy.ts');
const Op = { in: Symbol('in'), or: Symbol('or'), like: Symbol('like') };

function fixture({ status = 'failed', bank = 'IZB', missing = false, duplicate = false, sageExisting = false, fail = false, bankRace = false, bankFailure = false } = {}) {
  const notification = { transactionId: 'IDC8A24F91C0', bankCode: 'IZB', description: 'Jason Songwe',
    noEntries: 1, creditAmount: 5000, debitAmount: 5000, entries: [{ entryNo: 1, referenceNo: 'IDC8A24F91C0', customerNo: 'PK-0034-IDC',
      noDetails: 1, amount: 5000, currency: 'ZMW', details: [{ entryDescription: 'Jason Songwe', accountId: 'GL-TEST', amount: 5000, DrCr: 'Cr', detailNo: 1 }] }] };
  const audit = [], writes = [], processed = new Map(), receipts = [], sageHeaders = new Map();
  const queue = { id: 1, queueId: 'original', bankCode: bank, paymentId: notification.transactionId, status: 'failed',
    paymentPayload: JSON.stringify({ paymentId: notification.transactionId, sageBankCode: '77050', amount: 5000, currency: 'ZMW' }) };
  if (bankFailure) Object.assign(queue, { responsePayload: JSON.stringify({ protocol: 'izb-bank-status-v1', bankStatus: 'failed' }), lastError: 'INVALID_ACCOUNT: Bank could not credit account' });
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
    '@/app/lib/sageDb': { __esModule: true, default: sage, connectSageDatabase: async () => { throw new Error('Sage must never be contacted when recording bank notifications'); } },
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

test('bank notifications are stored locally without Sage connectivity or original Sage bank codes', async () => {
  const f = fixture({ fail: true });
  f.queue.paymentPayload = JSON.stringify({ paymentId: f.notification.transactionId });
  const result = await f.core.processCashbookReceipt(f.notification);
  assert.equal(result.success, true);
  assert.equal(result.batchId, '');
  assert.equal(f.writes.length, 0);
  assert.equal(f.receipts[0].status, 'success');
  assert.equal(f.queue.status, 'success');
  const response = JSON.parse(f.queue.responsePayload);
  assert.deepEqual(response.bankNotification, f.notification);
  assert.equal(response.notificationStatus, 'success');
});

test('duplicate notifications do not create additional local receipts or Sage writes', async () => {
  const f = fixture();
  assert.equal((await f.core.processCashbookReceipt(f.notification)).success, true);
  assert.equal((await f.core.processCashbookReceipt(f.notification)).alreadyProcessed, true);
  assert.equal(f.receipts.length, 1);
  assert.equal(f.writes.length, 0);
});

test('legacy Sage writer cannot be called even through the H2H helper', async () => {
  const f = fixture();
  await assert.rejects(() => f.core.postConfirmedH2hCashbook(f.notification), /Sage posting is disabled/);
  assert.equal(f.writes.length, 0);
});

test('original bank reference and extra response fields survive normalization', () => {
  const f = fixture();
  const original = { ...f.notification, bankReference: 'BANK-123', bankStatus: 'PAID', extra: { message: 'Confirmed' } };
  const normalized = contract.normalizeReceiptRequest(original);
  assert.deepEqual(normalized.bankResponse, original);
});

test('IZB bank reference is retained in the local queue response for reconciliation', async () => {
  const f = fixture();
  const receipt = contract.normalizeReceiptRequest({ ...f.notification, bankReference: 'IZB-RECON-009' });
  assert.equal((await f.core.processCashbookReceipt(receipt)).success, true);
  assert.equal(JSON.parse(f.queue.responsePayload).bankNotification.bankResponse.bankReference, 'IZB-RECON-009');
  assert.equal(f.writes.length, 0);
});

test('success notifications for corrected IZB attempts cannot match their predecessor by shared Sage ID', async () => {
  const f = fixture();
  f.queue.paymentPayload = JSON.stringify({ paymentId: f.notification.transactionId,
    transactionId: 'IDCNEW123456', izbAttemptReference: 'IDCNEW123456', recoveryOf: 'predecessor' });
  await f.core.processCashbookReceipt(f.notification);
  assert.equal(f.queue.status, 'failed', 'old success callback must not complete the successor');
  const corrected = { ...f.notification, transactionId: 'IDCNEW123456',
    entries: f.notification.entries.map(entry => ({ ...entry, referenceNo: 'IDCNEW123456' })) };
  await f.core.processCashbookReceipt(corrected);
  assert.equal(f.queue.status, 'success');
  assert.equal(JSON.parse(f.queue.responsePayload).bankNotification.transactionId, 'IDCNEW123456');
});
