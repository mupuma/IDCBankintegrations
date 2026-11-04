const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/portal.cjs');

function fixture() {
  const Op = { in: Symbol('in') };
  const event = { eventId: 'IZB-EVENT-1', transactionId: 'IDC8A24F91C0', status: 'failed', errorCode: 'INVALID_ACCOUNT', errorMessage: 'Beneficiary account is invalid' };
  const hydrate = value => Object.assign(value, { update: async function (values) { Object.assign(this, values); } });
  const rows = [hydrate({ queueId: 'QUEUE-1', paymentId: event.transactionId, bankCode: 'IZB', status: 'pulled', paymentPayload: JSON.stringify({ paymentId: event.transactionId, amount: 5000 }), attempts: 1 })];
  const audits = [], receipts = [], processed = [];
  let tail = Promise.resolve(), failAudit = false;
  const matches = (row, where) => Object.entries(where).every(([key, value]) => row[key] === value);
  const db = { transaction: fn => {
    const run = async () => {
      const before = JSON.stringify(rows), count = audits.length;
      try { return await fn({ LOCK: { UPDATE: 'UPDATE' } }); }
      catch (error) { rows.splice(0, rows.length, ...JSON.parse(before).map(hydrate)); audits.length = count; throw error; }
    };
    const result = tail.then(run, run); tail = result.catch(() => {}); return result;
  } };
  const core = load('idcbanksinegration/app/lib/izbPaymentStatus.ts', {
    sequelize: { Op }, './db': { connectDatabase: async () => {}, getSequelize: async () => db },
    '@/app/models/internal/PaymentQueueRequest': { PaymentQueueRequest: {
      findAll: async ({ where }) => rows.filter(row => matches(row, where)),
      findOne: async options => { assert.equal(options.lock, 'UPDATE'); return rows.find(row => matches(row, options.where)); },
    } },
    '@/app/models/internal/CashbookReceipt': { CashbookReceipt: { findOne: async ({ where }) => receipts.find(row => row.bankCode === where.bankCode && where.transactionId[Op.in].includes(row.transactionId)) } },
    '@/app/models/internal/Processed_transactions': { ProcessedTransaction: { findOne: async ({ where }) => processed.find(row => row.bankCode === where.bankCode && where.transactionId[Op.in].includes(row.transactionId)) } },
    '@/app/models/internal/AuditLog': { AuditLog: {
      findOne: async ({ where, lock }) => { assert.equal(lock, 'UPDATE'); return audits.find(row => matches(row, where)); },
      create: async values => { if (failAudit) throw new Error('Audit storage unavailable'); audits.push(values); },
    } },
  });
  const route = load('idcbanksinegration/app/api/v1/izb/payment-status/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    '@/app/lib/izbPaymentStatus': core,
  });
  return { event, rows, audits, receipts, processed, record: core.recordIzbPaymentFailure, route, failAudit: () => { failAudit = true; },
    addRow: values => rows.push(hydrate({ ...rows[0], ...values })),
  };
}

test('IZB bank failure updates the original payment and error, without creating a cashbook or changing money', async () => {
  const f = fixture(); const before = f.rows[0].paymentPayload;
  const result = await f.record(f.event);
  assert.equal(result.status, 'failed'); assert.equal(result.duplicate, false);
  assert.equal(f.rows[0].status, 'failed');
  assert.equal(f.rows[0].lastError, 'INVALID_ACCOUNT: Beneficiary account is invalid');
  assert.equal(f.rows[0].paymentPayload, before); assert.equal(f.rows[0].attempts, 1);
  assert.equal(JSON.parse(f.rows[0].responsePayload).protocol, 'izb-bank-status-v1');
  assert.equal(f.audits.length, 1); assert.equal(f.audits[0].action, 'IZB_PAYMENT_FAILED');
  assert.equal(f.receipts.length, 0); assert.equal(f.processed.length, 0);
});

test('duplicate and concurrent failure callbacks are idempotent and changed reuse of eventId is rejected', async () => {
  const f = fixture();
  const results = await Promise.all([f.record(f.event), f.record(f.event)]);
  assert.equal(results.filter(result => result.duplicate).length, 1); assert.equal(f.audits.length, 1);
  await assert.rejects(() => f.record({ ...f.event, errorMessage: 'Different callback' }), error => error.status === 409);
  assert.equal(f.audits.length, 1);
  f.rows[0].status = 'success';
  assert.equal((await f.record(f.event)).status, 'success');
  assert.equal(f.rows[0].status, 'success');
});

test('unknown, ambiguous and wrong-bank references are rejected; optional queueId disambiguates history', async () => {
  const f = fixture();
  await assert.rejects(() => f.record({ ...f.event, transactionId: 'UNKNOWN' }), error => error.status === 404);
  f.addRow({ queueId: 'QUEUE-2' });
  await assert.rejects(() => f.record(f.event), error => error.status === 409);
  assert.equal((await f.record({ ...f.event, queueId: 'QUEUE-1' })).queueId, 'QUEUE-1');
  assert.equal(f.rows[1].status, 'pulled');
  const other = fixture(); other.rows[0].bankCode = 'ZICB';
  await assert.rejects(() => other.record(other.event), error => error.status === 404);
  const alias = fixture(); alias.rows[0].paymentId = 'LOCAL-ID'; alias.rows[0].paymentPayload = JSON.stringify({ transactionId: alias.event.transactionId });
  assert.equal((await alias.record(alias.event)).status, 'failed');
});

test('completed, unpulled and cashbook-confirmed payments cannot be downgraded by a bank failure', async () => {
  for (const status of ['success', 'paid', 'queued', 'needs_review']) {
    const f = fixture(); f.rows[0].status = status;
    await assert.rejects(() => f.record(f.event), error => error.status === 409);
    assert.equal(f.rows[0].status, status); assert.equal(f.audits.length, 0);
  }
  for (const target of ['receipts', 'processed']) {
    const f = fixture(); f[target].push({ bankCode: 'IZB', transactionId: f.event.transactionId, status: 'failed' });
    await assert.rejects(() => f.record(f.event), /cashbook notification already exists/);
    assert.equal(f.rows[0].status, 'pulled');
  }
});

test('invalid callbacks are rejected and audit failure rolls back the queue change', async () => {
  const f = fixture();
  for (const body of [null, [], { ...f.event, status: 'success' }, { ...f.event, eventId: '' }, { ...f.event, errorMessage: '' }, { ...f.event, errorCode: 123 }]) {
    await assert.rejects(() => f.record(body), error => error.status === 400);
  }
  f.failAudit(); await assert.rejects(() => f.record(f.event), /Audit storage unavailable/);
  assert.equal(f.rows[0].status, 'pulled'); assert.equal(f.audits.length, 0);
});

test('portal callback requires the bank key and returns actionable HTTP statuses', async t => {
  const previous = process.env.BANK_PULL_API_KEY;
  process.env.BANK_PULL_API_KEY = 'portal-key';
  t.after(() => { if (previous === undefined) delete process.env.BANK_PULL_API_KEY; else process.env.BANK_PULL_API_KEY = previous; });
  const f = fixture();
  const request = (key, body = f.event) => ({ headers: new Headers(key ? { 'x-bank-api-key': key } : {}), json: async () => body });
  assert.equal((await f.route.POST(request(null))).status, 401);
  assert.equal((await f.route.POST(request('wrong'))).status, 401);
  assert.equal((await f.route.POST({ headers: new Headers({ 'x-bank-api-key': 'portal-key' }), json: async () => { throw new Error('bad JSON'); } })).status, 400);
  assert.equal((await f.route.POST(request('portal-key', { ...f.event, status: 'success' }))).status, 400);
  assert.equal((await f.route.POST(request('portal-key'))).status, 200);
  assert.equal((await f.route.POST(request('portal-key'))).body.duplicate, true);
});

test('agent forwards failure callback to the portal with its own key and preserves bank-facing errors', async t => {
  const previous = { APP_API_URL: process.env.APP_API_URL, AGENT_API_KEY: process.env.AGENT_API_KEY, BANK_PULL_API_KEY: process.env.BANK_PULL_API_KEY };
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  Object.assign(process.env, { APP_API_URL: 'http://portal', AGENT_API_KEY: 'agent-key', BANK_PULL_API_KEY: 'portal-key' });
  const routes = new Map();
  const app = { use() {}, post: (path, handler) => routes.set(path, handler), get() {}, listen() {} };
  const express = Object.assign(() => app, { json: () => () => {} });
  load('microservices/izb-agent-service/src/index.ts', { express, cors: () => () => {}, dotenv: { config() {} }, './db': { initDatabase() {} }, '../../../shared/http-logging': { installHttpLogging() {} } });
  const handler = routes.get('/api/v1/payments/status');
  const response = () => ({ statusCode: 200, status(value) { this.statusCode = value; return this; }, type() { return this; }, send(body) { this.body = body; return this; }, json(body) { this.body = body; return this; } });
  assert.equal((await handler({ headers: {}, body: {} }, response())).statusCode, 401);
  let sent;
  global.fetch = async (url, options) => { sent = { url, options }; return new Response('{"error":"Unknown transaction"}', { status: 404, headers: { 'content-type': 'application/json' } }); };
  const payload = fixture().event, res = response();
  await handler({ headers: { 'x-api-key': 'agent-key' }, body: payload }, res);
  assert.equal(sent.url, 'http://portal/api/v1/izb/payment-status');
  assert.deepEqual(JSON.parse(sent.options.body), payload);
  assert.equal(sent.options.headers['x-bank-api-key'], 'portal-key');
  assert.equal(res.statusCode, 404);
  assert.ok(sent.options.signal instanceof AbortSignal);
  assert.equal(sent.options.redirect, 'error');
  global.fetch = async () => { throw new Error('private transport error'); };
  const unavailable = await handler({ headers: { 'x-api-key': 'agent-key' }, body: payload }, response());
  assert.equal(unavailable.statusCode, 503); assert.ok(unavailable.body.error.includes('same eventId'));
});
