const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '../../../idcbanksinegration', relative);
  const mod = new Module(filename);
  mod.filename = filename;
  mod.require = id => id.startsWith('node:') ? require(id) : mocks[id] ?? {};
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, filename);
  return mod.exports;
}

test('Infratel server rejects disabled banks before creating payment work', async () => {
  const enabled = load('app/lib/enabledBanks.ts');
  assert.deepEqual(enabled.BANK_CODES, ['ZICB']);
  const route = load('app/api/v1/posted_payments/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    '../../../lib/banks': enabled,
    '../../../lib/rbac': { requirePermission: async () => ({ id: 1 }), isAuthError: () => false },
    '../../../lib/permissions': { PERMISSIONS: { PAYMENTS_POST: 'post' } },
    '@/app/lib/terminalLog': { terminalLog() {} },
  });
  for (const bankCode of ['IZB', 'ZANACO', 'OTHER']) {
    const result = await route.POST({ json: async () => ({ bankCode, payment: { paymentId: 'test' } }) });
    assert.equal(result.status, 400);
    assert.match(result.body.error, /bankCode must be one of ZICB/);
  }
});

test('Infratel H2H refuses legacy mobile-money instructions', () => {
  const contract = require('../../../shared/zicb-h2h');
  const errors = contract.paymentErrors({ transactionType: 'MOBILE_MONEY', amount: 100, currency: 'ZMW', accountNumber: '260970000000' }, 2);
  assert.deepEqual(errors, ['ZICB supports Internal FT, RTGS and DDACC; this payment type is not supported']);
});

test('Infratel permits the cashbook coordination lock but never schema changes', () => {
  const policy = load('app/lib/sageQueryPolicy.ts');
  assert.doesNotThrow(() => policy.assertSageQueryAllowed(policy.SAGE_CASHBOOK_LOCK_SQL));
  assert.throws(() => policy.assertSageQueryAllowed(policy.SAGE_CASHBOOK_LOCK_SQL, false), /read-only/);
  for (const sql of [
    'CREATE TABLE VENBANK (ID INT)', 'ALTER TABLE VENBANK ADD TPIN INT',
    'DROP TABLE VENBANK', 'EXEC sp_executesql @sql',
    policy.SAGE_CASHBOOK_LOCK_SQL + ' ALTER TABLE VENBANK ADD X INT;',
  ]) assert.throws(() => policy.assertSageQueryAllowed(sql), /changes are disabled/);
});

test('Infratel retains its logo and login imagery while exposing reports and separated roles', () => {
  const app = path.resolve(__dirname, '../../../idcbanksinegration');
  const sidebar = fs.readFileSync(path.join(app, 'app/bank_details/BankDetailsSidebar.tsx'), 'utf8');
  const login = fs.readFileSync(path.join(app, 'app/login/page.tsx'), 'utf8');
  assert.match(sidebar, /src="\/infratel.png" alt="Infratel Logo"/);
  assert.doesNotMatch(sidebar, /src="\/idc_logo.png"/);
  assert.match(sidebar, /Transaction Reports/);
  assert.match(login, /src="\/infratel.png"/); assert.match(login, /src="\/wall2.jpeg"/);
  const { ROLES, PERMISSIONS: P, roleHasPermission: has } = load('app/lib/permissions.ts');
  assert.equal(has(ROLES.BANK_DETAILS_MAKER, P.BANK_DETAILS_WRITE), true);
  assert.equal(has(ROLES.BANK_DETAILS_MAKER, P.PAYMENTS_POST), false);
  assert.equal(has(ROLES.OPERATOR, P.PAYMENTS_POST), true);
  assert.equal(has(ROLES.OPERATOR, P.BANK_DETAILS_WRITE), false);
  assert.equal(has(ROLES.OPERATOR, P.REPORTS_READ), true);
  assert.equal(has(ROLES.ADMIN, P.REPORTS_READ), true);
});

test('Infratel reports reject disabled banks and scope all-bank scans to ZICB', async () => {
  const enabled = load('app/lib/enabledBanks.ts');
  const report = load('app/lib/transactionReports.ts', { './enabledBanks': enabled });
  for (const bank of ['IZB', 'ZANACO']) assert.throws(() => report.parseReportFilters(new URLSearchParams({ bank })), /Invalid bank/);
  const Op = { in: Symbol('in') };
  const store = load('app/lib/transactionReportStore.ts', {
    sequelize: { Op }, './enabledBanks': enabled, './db': { connectDatabase: async () => {} },
    '@/app/models/internal/PaymentQueueRequest': { PaymentQueueRequest: {
      findOne: async ({ where }) => { assert.deepEqual(where.bankCode[Op.in], ['ZICB']); return null; },
    } },
  });
  for await (const _row of store.matchingReportRows(report.parseReportFilters(new URLSearchParams()))) assert.fail('empty store');
});

test('Infratel recovery cannot operate on disabled bank records', async () => {
  const enabled = load('app/lib/enabledBanks.ts');
  let row;
  const recovery = load('app/lib/paymentRecovery.ts', {
    './enabledBanks': enabled, './db': { connectDatabase: async () => {} },
    '@/app/models/internal/PaymentQueueRequest': { PaymentQueueRequest: { findOne: async () => row } },
  });
  for (const bankCode of ['IZB', 'ZANACO']) {
    row = { queueId: 'disabled', paymentId: 'DISABLED1', bankCode, status: 'failed' };
    await assert.rejects(recovery.getRecoveryDetails('disabled'), /Payment not found/);
    await assert.rejects(recovery.requestPaymentRecovery({ queueId: 'disabled', action: 'new_attempt',
      actionId: '11111111-1111-4111-8111-111111111111', reason: 'Confirmed bank rejection', confirmed: true,
      username: 'operator', corrections: {} }), /Payment not found/);
  }
});
