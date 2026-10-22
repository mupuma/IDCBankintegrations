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
