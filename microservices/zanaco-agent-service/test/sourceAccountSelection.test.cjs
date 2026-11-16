const test = require('node:test');
const assert = require('node:assert/strict');
const { load, routeFixture } = require('./helpers/portal.cjs');
const { processingBankFor, sourceAccountsForBank, sourceSelectionError } = load('idcbanksinegration/app/lib/sourceAccountSelection.ts');

test('each bank lists multiple assigned Sage source codes without leaking other banks or inactive accounts', () => {
  const sources = [
    { bank: '77050', processingBank: 'IZB' },
    { bank: '77051', processingBank: 'IZB' },
    { bank: '88001', processingBank: 'ZICB' },
    { bank: '77052', processingBank: 'IZB', inactive: 1 },
    { bank: '77053', processingBank: 'IZB', isActive: false },
    { bank: '99999', name: 'IZB unassigned account' },
  ];
  assert.deepEqual(sourceAccountsForBank(sources, 'IZB').map(s => s.bank), ['77050', '77051']);
  assert.deepEqual(sourceAccountsForBank(sources, 'ZICB').map(s => s.bank), ['88001']);
  assert.deepEqual(sourceAccountsForBank(sources, ''), []);
  assert.equal(processingBankFor({ bank: ' izb ' }), 'IZB');
  assert.equal(processingBankFor(sources[5]), '');
  assert.equal(processingBankFor({ bank: 'IZB', processingBank: 'ZICB' }), 'ZICB');
});

test('missing, unassigned, mismatched and inactive accounts produce clear errors', () => {
  assert.match(sourceSelectionError(null, 'ZICB'), /Select a source account/);
  assert.match(sourceSelectionError({ bank: '77050' }, 'ZICB'), /does not belong/);
  assert.match(sourceSelectionError({ bank: '77050', processingBank: 'IZB' }, 'ZICB'), /does not belong/);
  assert.match(sourceSelectionError({ bank: 'ZICB', inactive: 1 }, 'ZICB'), /inactive/);
  assert.equal(sourceSelectionError({ bank: '77050', processingBank: 'ZICB' }, 'ZICB'), null);
});

test('posting API rejects mismatched and missing source accounts for single and bulk requests before queueing', async () => {
  for (const payload of [{ payment: { paymentId: 'PAY-1' } }, { payments: [{ paymentId: 'PAY-1' }] }]) {
    const f = routeFixture({ source: { bank: '77050', processingBank: 'IZB', accountNumber: '123456' } });
    const result = await f.post({ bankCode: 'ZICB', sourceBank: '77050', ...payload });
    assert.equal(result.status, 400);
    assert.match(result.body.error, /does not belong/);
    assert.equal(f.records.length, 0);
    const missing = await f.post({ bankCode: 'ZICB', ...payload });
    assert.equal(missing.status, 400);
    assert.match(missing.body.error, /Select a source account/);
  }
});

test('source-account merges retain the processing bank, Sage code and inactive local status', () => {
  const { mergeSourceRecords, serializeSourceAccount } = load('idcbanksinegration/app/lib/sourceAccounts.ts', {
    '@/app/lib/db': {}, '@/app/lib/sageDb': {}, '@/app/models/internal/SourceAccount': {},
    '@/app/models/sage_entities/Bkacct': {}, './sourceAccountSelection': { processingBankFor },
  });
  const merged = mergeSourceRecords({ bank: '77050', name: 'Sage Account', accountNumber: '123', transit: '001', inactive: 0 },
    { bank: '77050', processingBank: 'ZICB', isActive: false });
  assert.equal(merged.bank, '77050');
  assert.equal(merged.processingBank, 'ZICB');
  assert.equal(merged.accountNumber, '123');
  assert.equal(merged.inactive, 1);
  assert.deepEqual(sourceAccountsForBank([merged], 'ZICB'), []);
  assert.equal(serializeSourceAccount({ bank: '77050', processingBank: 'ZICB' }).processingBank, 'ZICB');
});

test('account APIs require a processing bank, allow multiple source codes per bank and audit reassignment', async () => {
  const rows = new Map(), audits = [];
  const mocks = {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    '@/app/lib/db': { connectDatabase: async () => {} },
    '@/app/lib/auditLog': { logAuditEvent: async event => audits.push(event) },
    '@/app/lib/permissions': { PERMISSIONS: { BANK_DETAILS_WRITE: 'write' } },
    '@/app/lib/rbac': { requirePermission: async () => ({ id: 1, username: 'maker' }), isAuthError: () => false },
    '@/app/lib/banks': { BANK_CODES: ['ZICB', 'IZB'] },
    '@/app/lib/sourceAccounts': { listSourceBanks: async () => [], serializeSourceAccount: row => ({ bank: row.bank, processingBank: row.processingBank }) },
    '@/app/models/internal/SourceAccount': { SourceAccount: {
      findOne: async ({ where }) => rows.get(where.bank),
      create: async data => { const row = { ...data, update: async change => Object.assign(row, change) }; rows.set(data.bank, row); return row; },
    } },
  };
  const create = load('idcbanksinegration/app/api/v1/source_accounts/route.ts', mocks).POST;
  const update = load('idcbanksinegration/app/api/v1/source_accounts/[bank]/route.ts', mocks).PUT;
  assert.equal((await create({ json: async () => ({ bank: '77050' }) })).status, 400);
  assert.equal(rows.size, 0);
  for (const bank of ['77050', '77051']) {
    const response = await create({ json: async () => ({ bank, processingBank: 'ZICB', accountNumber: bank }) });
    assert.equal(response.status, 201);
    assert.equal(response.body.item.processingBank, 'ZICB');
  }
  assert.equal(rows.size, 2);
  const response = await update({ json: async () => ({ processingBank: 'IZB', accountNumber: '77050' }) }, { params: Promise.resolve({ bank: '77050' }) });
  assert.equal(response.status, 200);
  assert.equal(rows.get('77050').processingBank, 'IZB');
  assert.deepEqual(audits.at(-1).details.before, { bank: '77050', processingBank: 'ZICB' });
  assert.deepEqual(audits.at(-1).details.after, { bank: '77050', processingBank: 'IZB' });
});

function paymentPageFixture() {
  const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
  const ts = require('typescript');
  const states = [];
  let index = 0;
  const payment = { paymentId: 'PAY-1', vendorId: 'VENDOR-1', amount: 100, currency: 'ZMW', transactionType: 'RTGS', transactionDate: '2026-11-16' };
  states[2] = [payment];
  states[14] = [{ bank: '77050', processingBank: 'ZICB' }, { bank: '77051', processingBank: 'ZICB' }, { bank: '88001', processingBank: 'IZB' }];
  const filename = path.resolve(__dirname, '../../../idcbanksinegration/app/bank_details/payments/page.tsx');
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  const mocks = {
    react: { useState: initial => { const key = index++; if (!(key in states)) states[key] = typeof initial === 'function' ? initial() : initial;
      return [states[key], value => { states[key] = typeof value === 'function' ? value(states[key]) : value; }]; },
      useMemo: fn => fn(), useCallback: fn => fn, useEffect: () => {} },
    '@/app/lib/sourceAccountSelection': { sourceAccountsForBank, sourceSelectionError },
    '@/app/lib/usePortalUser': { usePortalUser: () => ({ hasPermission: () => true }) },
    '@/app/lib/permissions': { PERMISSIONS: { PAYMENTS_POST: 'post' } },
    '@/app/lib/useAdaptiveQueuePolling': { useAdaptiveQueuePolling: () => ({ refresh: async () => {} }) },
    '@/app/lib/bankResponseDetails': { bankResponseReferences: () => [] },
    '@/app/components/TransactionHealth': { __esModule: true, default: () => null },
    '@/app/lib/enabledBanks': { BANK_CODES: ['ZICB', 'IZB', 'ZANACO'] },
    '@/app/lib/banks/payloadBuilders': {},
  };
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : original(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  function elements(node, type) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(child => elements(child, type));
    return [...(node.type === type ? [node] : []), ...elements(node.props?.children, type)];
  }
  return { states, render: () => { index = 0; return elements(mod.exports.default(), 'select'); },
    buttons: () => { index = 0; return elements(mod.exports.default(), 'button'); },
    options: select => elements(select, 'option').map(option => option.props.value) };
}

test('individual selection requires bank then a matching source then type, clearing dependent choices on change', () => {
  const f = paymentPageFixture();
  let selects = f.render();
  // Bulk controls are followed by the individual payment controls.
  assert.equal(selects[3].props.value, '');
  assert.equal(selects[4].props.disabled, true);
  assert.equal(selects[5].props.disabled, true);
  selects[3].props.onChange({ target: { value: 'ZICB' } });
  selects = f.render();
  assert.deepEqual(f.options(selects[4]), ['', '77050', '77051']);
  assert.equal(selects[5].props.disabled, true);
  selects[4].props.onChange({ target: { value: '77050' } });
  selects = f.render();
  assert.equal(selects[5].props.disabled, false);
  assert.equal(selects[5].props.value, '', 'the Sage type is not silently selected');
  selects[5].props.onChange({ target: { value: 'RTGS' } });
  selects = f.render();
  selects[4].props.onChange({ target: { value: '77051' } });
  selects = f.render();
  assert.equal(selects[5].props.value, '');
  selects[3].props.onChange({ target: { value: 'IZB' } });
  selects = f.render();
  assert.equal(selects[4].props.value, '');
  assert.deepEqual(f.options(selects[4]), ['', '88001']);
  assert.equal(selects[5].props.disabled, true);
});

test('bulk selection filters source accounts and clears both dependent controls when bank changes', () => {
  const f = paymentPageFixture();
  let selects = f.render();
  assert.equal(selects[1].props.disabled, true);
  assert.equal(selects[2].props.disabled, true);
  selects[0].props.onChange({ target: { value: 'ZICB' } });
  selects = f.render();
  assert.deepEqual(f.options(selects[1]), ['', '77050', '77051']);
  selects[1].props.onChange({ target: { value: '77050' } });
  selects = f.render();
  selects[2].props.onChange({ target: { value: 'RTGS' } });
  selects = f.render();
  selects[0].props.onChange({ target: { value: 'IZB' } });
  selects = f.render();
  assert.equal(selects[1].props.value, '');
  assert.deepEqual(f.options(selects[1]), ['', '88001']);
  assert.equal(selects[2].props.value, '');
  assert.equal(selects[2].props.disabled, true);
});

test('bulk validation checks selections across pages, retains every result and never sends requests', () => {
  const f = paymentPageFixture();
  f.render();
  const rows = Array.from({ length: 75 }, (_, i) => ({
    paymentId: `PAY-${i}`, vendorId: 'VENDOR-1', amount: 100, currency: 'ZMW', transactionType: 'RTGS',
    transactionDate: '2026-11-16', transactionReference: `REF-${i}`, accountName: 'Supplier',
    accountNumber: '123456789', bankName: 'Beneficiary Bank', branchCode: '001', sortCode: '001001',
    swiftCode: 'ZICBZMLU', bankDetailsFound: true,
  }));
  f.states[2] = rows;
  f.states[3] = Object.fromEntries(rows.map(row => [row.paymentId, 'ZICB']));
  f.states[4] = Object.fromEntries(rows.map(row => [row.paymentId, 'RTGS']));
  f.states[5] = Object.fromEntries(rows.map(row => [row.paymentId, true]));
  f.states[15] = Object.fromEntries(rows.map(row => [row.paymentId, '77050']));
  delete f.states[3]['PAY-70'];
  f.states[15]['PAY-71'] = '88001';
  delete f.states[4]['PAY-72'];
  f.states[2][73] = { ...rows[73], accountNumber: '' };
  f.states[5]['PAY-74'] = false;
  const button = f.buttons().find(b => Array.isArray(b.props.children) && b.props.children[0] === 'Validate selected (');
  assert.ok(button);
  assert.equal(button.props.disabled, false);
  const originalFetch = global.fetch;
  global.fetch = () => { throw new Error('Validation must not send a request'); };
  try { button.props.onClick(); } finally { global.fetch = originalFetch; }
  const results = f.states[18];
  assert.equal(Object.keys(results).length, 74, 'all selected rows, including other pages, get results');
  assert.equal(results['PAY-69'].valid, true);
  assert.match(results['PAY-70'].errors.join(), /Select a bank/);
  assert.match(results['PAY-71'].errors.join(), /does not belong/);
  assert.match(results['PAY-72'].errors.join(), /transaction type/);
  assert.match(results['PAY-73'].errors.join(), /accountNumber/);
  assert.equal(results['PAY-74'], undefined);
  assert.match(f.states[20], /Validated 74 selected payments: 70 ready, 4 need attention/);
});

test('bulk validation button is disabled until payments are selected', () => {
  const f = paymentPageFixture();
  const button = f.buttons().find(b => Array.isArray(b.props.children) && b.props.children[0] === 'Validate selected (');
  assert.equal(button.props.disabled, true);
});

test('bulk validation applies top-level settings without a separate Apply click or stale-state errors', () => {
  const f = paymentPageFixture();
  f.render();
  f.states[5] = { 'PAY-1': true };
  f.states[6] = 'ZICB';
  f.states[8] = '77050';
  f.states[7] = 'RTGS';
  const button = f.buttons().find(b => Array.isArray(b.props.children) && b.props.children[0] === 'Validate selected (');
  button.props.onClick();
  assert.equal(f.states[3]['PAY-1'], 'ZICB');
  assert.equal(f.states[15]['PAY-1'], '77050');
  assert.equal(f.states[4]['PAY-1'], 'RTGS');
  const errors = f.states[18]['PAY-1'].errors.join('; ');
  assert.doesNotMatch(errors, /Select a bank|Select a source account|Select a transaction type/);
  assert.match(errors, /accountNumber/, 'real beneficiary validation still runs');
});

test('incomplete bulk settings prompt for the missing choices without assigning or validating stale row settings', () => {
  const f = paymentPageFixture();
  f.render();
  f.states[5] = { 'PAY-1': true };
  f.states[6] = 'ZICB';
  const button = f.buttons().find(b => Array.isArray(b.props.children) && b.props.children[0] === 'Validate selected (');
  button.props.onClick();
  assert.match(f.states[20], /Complete the bulk settings/);
  assert.deepEqual(f.states[18], {});
  assert.deepEqual(f.states[3], {});
});
