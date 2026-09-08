const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
// Compile only pure modules in this test process; never import the running server.
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, filename);
const contract = require('../../../shared/zicb-h2h');
const { H2hClient } = require('../src/h2hClient.ts');
const { processH2hWork } = require('../src/h2hRunner.ts');
const security = require('../../../idcbanksinegration/app/lib/zicb/security.ts');

const payment = { paymentId: 'SAGE-1001', transactionType: 'RTGS', amount: 25.10, accountNumber: '001142662',
  accountName: 'Test Beneficiary', branchCode: '003', swiftCode: 'TESTZMLX', sortCode: '020016',
  currency: 'ZMW', transactionDate: '2026-09-07', remarks: 'Supplier payment', vendorId: 'V001' };
const options = { reference: 'batch-1', prcn: 'IDC-1', regionCode: 'TEST', amountScale: 2 };
const batch = () => contract.buildBatch(payment, options);
const profile = { clientId: 'test-id', clientSecret: 'test-secret', authUrl: 'https://auth.test', internalUrl: 'https://internal.test', rtgsUrl: 'https://rtgs.test', ddaccUrl: 'https://ddacc.test' };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const token = () => json(200, { access_token: 'test-token', token_type: 'Bearer', expires_in: 5400 });
const accepted = () => json(202, { error: null, status: 201, message: 'Pending processing' });
const work = { queueId: 'q1', leaseToken: 'lease1', action: 'submit', profileId: 'test', channel: 'RTGS', batch: batch(), amountScale: 2 };

test('all three channels produce the documented one-item batch, preserving leading zeros', () => {
  for (const type of ['RTGS', 'DDACCT', 'INT']) {
    const b = contract.buildBatch({ ...payment, transactionType: type, accountNumber: type === 'INT' ? '0010066244206' : payment.accountNumber }, options);
    assert.equal(b.count, 1); assert.equal(b.transactions[0].is_retry, 0);
    assert.equal(b.transactions[0].prcn_number, options.prcn);
    assert.equal(b.transactions[0][type === 'INT' ? 'account_number' : 'receiver_account_number'], type === 'INT' ? '0010066244206' : '001142662');
    assert.equal(b.service, undefined); assert.equal(b.request, undefined);
  }
});
test('decimal-safe batch totals accept 0.1 + 0.2 as 0.3 and reject floating drift', () => {
  const b = batch(); b.transactions = [{ ...b.transactions[0], amount: 0.1 }, { ...b.transactions[0], prcn_number: 'IDC-2', amount: 0.2 }]; b.count = 2; b.total_amount = 0.3;
  assert.deepEqual(contract.validateBatch('RTGS', b), []);
  b.total_amount = 0.1 + 0.2;
  assert.ok(contract.validateBatch('RTGS', b).length);
});
test('reject duplicate references, invalid count, BIC, dates, precision and long narration', () => {
  const b = batch(); b.transactions.push({ ...b.transactions[0] });
  const errors = contract.validateBatch('RTGS', b);
  assert.ok(errors.some(e => e.includes('duplicated'))); assert.ok(errors.some(e => e.includes('count')));
  for (const change of [{ swiftCode: '' }, { transactionDate: '2026-02-30' }, { amount: 0 }, { amount: '1.001' }, { remarks: 'x'.repeat(36) }, { transactionType: 'TT' }]) {
    assert.throws(() => contract.buildBatch({ ...payment, ...change }, options));
  }
});
test('internal transfer does not require international sender fields', () => {
  assert.deepEqual(contract.paymentErrors({ ...payment, transactionType: 'INT', accountNumber: '0010066244206', swiftCode: '', sortCode: '', physicalAddress: undefined }), []);
});
test('202 is acceptance only; malformed 200 and duplicate references remain unresolved', () => {
  assert.equal(contract.submissionOutcome(202, { error: null, status: 201 }).state, 'accepted');
  for (const [status, body] of [[200, {}], [200, null], [202, { error: 'failure' }], [409, { error: 'duplicate_reference' }], [503, { error: 'service_unavailable' }]]) assert.equal(contract.submissionOutcome(status, body).state, 'unknown');
  assert.equal(contract.submissionOutcome(422, { error: 'items_failed_validation' }).state, 'rejected');
});
test('batch completion and an item still processing never establish payment', () => {
  const b = batch();
  const body = { batch_status: 'completed', ext_batch_ref_no: b.reference, transactions: [{ ...b.transactions[0], currency: 'ZMW', is_still_processing: true, status: 'completed_fcub_ft_sc_notified', bank_reference: 'BANK1' }] };
  assert.equal(contract.statusOutcome(body, b, 'RTGS').state, 'accepted');
  body.transactions[0].is_still_processing = false;
  assert.equal(contract.statusOutcome(body, b, 'RTGS').state, 'paid');
  body.transactions[0].amount = 500;
  assert.equal(contract.statusOutcome(body, b, 'RTGS').state, 'needs_review');
});
test('uncertain, unknown and missing-reference terminal statuses require review', () => {
  for (const status of ['failed_fcubs_notify_ft_status_check_sc_notified', 'new_bank_status', 'completed_fcub_ft_sc_notified']) {
    assert.equal(contract.itemOutcome({ is_still_processing: false, status }, 'RTGS').state, 'needs_review');
  }
});
test('mismatched status currency and malformed value-date suffixes are rejected', () => {
  const b = batch();
  const body = { ext_batch_ref_no: b.reference, transactions: [{ ...b.transactions[0], currency: 'USD', is_still_processing: false, status: 'completed_fcub_ft_sc_notified', bank_reference: 'BANK1' }] };
  assert.equal(contract.statusOutcome(body, b, 'RTGS').state, 'needs_review');
  assert.throws(() => contract.buildBatch({ ...payment, transactionDate: '2026-09-07garbage' }, options));
  assert.throws(() => contract.buildBatch({ ...payment, transactionDate: new Date('invalid') }, options));
});
test('callbacks require item identity, valid outcome and a posting reference on success', () => {
  assert.equal(contract.callbackErrors({ reference: 'b', prcn_number: 'p', status_code: 200 }).length, 1);
  assert.deepEqual(contract.callbackErrors({ reference: 'b', prcn_number: 'p', status_code: 400, bankRef: '' }), []);
  assert.ok(contract.callbackErrors({ reference: 'b', status_code: 500 }).length);
});
test('late responses cannot downgrade final settlement; conflicts are held', () => {
  assert.equal(contract.mergeOutcome('paid', 'accepted'), 'paid');
  assert.equal(contract.mergeOutcome('paid', 'unknown'), 'paid');
  assert.equal(contract.mergeOutcome('failed', 'accepted'), 'failed');
  assert.equal(contract.mergeOutcome('paid', 'failed'), 'needs_review');
  assert.equal(contract.mergeOutcome('needs_review', 'paid'), 'needs_review');
});
test('callback tokens are fresh, channel-bound and reject tampering, expiry and missing auth', () => {
  process.env.ZICB_H2H_WEBHOOK_SIGNING_KEY = 'test-only-key-with-at-least-32-characters';
  const one = security.issueCallbackToken('RTGS'), two = security.issueCallbackToken('RTGS');
  assert.notEqual(one, two);
  assert.equal(security.validCallbackToken(`Bearer ${one}`, 'RTGS'), true);
  assert.equal(security.validCallbackToken(`Bearer ${one}`, 'DDACC'), false);
  assert.equal(security.validCallbackToken(`Bearer ${one}x`, 'RTGS'), false);
  assert.equal(security.validCallbackToken(null, 'RTGS'), false);
  const original = Date.now;
  Date.now = () => original() + 301000;
  try { assert.equal(security.validCallbackToken(`Bearer ${one}`, 'RTGS'), false); } finally { Date.now = original; }
});
test('client caches credentials exchange and sends the correct Bearer endpoint and body', async () => {
  const calls = [];
  const bank = new H2hClient({ test: profile }, async (url, init) => { calls.push({ url, init }); return url.includes('client-credentials') ? token() : accepted(); });
  assert.equal((await bank.submit('test', 'RTGS', batch(), 2)).state, 'accepted');
  await bank.submit('test', 'DDACC', batch(), 2);
  assert.equal(calls.filter(c => c.url.includes('client-credentials')).length, 1);
  assert.equal(calls[1].url, 'https://rtgs.test/h2h/other-bank-rtgs-ft/v1/send-money');
  assert.equal(calls[1].init.headers.Authorization, 'Bearer test-token');
  assert.deepEqual(JSON.parse(calls[1].init.body), batch());
});
test('concurrent token requests share one acquisition and refresh before expiry', async () => {
  let calls = 0, now = 0;
  const bank = new H2hClient({ test: profile }, async () => { calls++; return token(); }, () => now);
  await Promise.all([bank.token('test'), bank.token('test'), bank.token('test')]);
  assert.equal(calls, 1);
  now = 5400000; await bank.token('test'); assert.equal(calls, 2);
});
test('refreshes invalid_token once, never replays a permission error', async () => {
  for (const error of ['invalid_token', 'permission_error']) {
    let auth = 0, sends = 0;
    const bank = new H2hClient({ test: profile }, async url => {
      if (url.includes('client-credentials')) { auth++; return token(); }
      sends++; return json(401, { error });
    });
    assert.equal((await bank.submit('test', 'RTGS', batch(), 2)).state, 'rejected');
    assert.equal(sends, error === 'invalid_token' ? 2 : 1); assert.equal(auth, sends);
  }
});
test('lost submission response does not resend money', async () => {
  let sends = 0;
  const bank = new H2hClient({ test: profile }, async url => {
    if (url.includes('client-credentials')) return token();
    sends++; throw new Error('Connection lost after bank commit');
  });
  assert.equal((await bank.submit('test', 'RTGS', batch(), 2)).state, 'unknown');
  assert.equal(sends, 1);
});
test('bank status query uses original batch reference and 404 does not authorize resubmission', async () => {
  let request;
  const bank = new H2hClient({ test: profile }, async (url, init) => {
    if (url.includes('client-credentials')) return token();
    request = { url, body: JSON.parse(init.body) }; return json(404, { error: 'reference_not_found' });
  });
  assert.equal((await bank.reconcile('test', 'RTGS', batch())).state, 'unknown');
  assert.deepEqual(request.body, { ext_batch_ref_no: 'batch-1' });
  assert.ok(request.url.endsWith('/transaction-status'));
});
test('report failures retry only reporting, not bank submission or accounting', async () => {
  let sends = 0, reports = 0, accounting = 0;
  const bank = { submit: async () => { sends++; return { state: 'accepted' }; }, reconcile: async () => { throw new Error('unexpected'); } };
  await assert.rejects(processH2hWork(work, bank, { report: async () => { reports++; throw new Error('portal down'); }, account: async () => { accounting++; } }));
  assert.equal(sends, 1); assert.equal(reports, 3); assert.equal(accounting, 0);
});
test('accounting recovery never calls the bank', async () => {
  let accounting = 0;
  const bank = { submit: async () => { throw new Error('Bank must not be called'); }, reconcile: async () => { throw new Error('Bank must not be called'); } };
  await processH2hWork({ ...work, action: 'accounting' }, bank, { account: async () => { accounting++; }, report: async () => { throw new Error('unexpected'); } });
  assert.equal(accounting, 1);
});
