const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/portal.cjs');
const { izbBankReferenceError } = require('../../../shared/izb-callback');
const contract = load('idcbanksinegration/app/lib/cashbookContract.ts');

function fixture() {
  const processed = [], audits = [];
  const route = load('idcbanksinegration/app/lib/postCashbookTransaction.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    '@/app/lib/cashbookService': { processCashbookReceipt: async receipt => { processed.push(receipt); return { success: true, receiptId: 1, batchId: '', status: 'success' }; },
      isCashbookAlreadyProcessed: () => false, isCashbookProcessError: () => false },
    '@/app/lib/cashbookContract': contract,
    '@/app/lib/auditLog': { logAuditEvent: async event => audits.push(event) },
    '@/app/lib/rbac': { requirePermission: async () => ({ id: 1, username: 'operator' }), isAuthError: () => false, getSessionUser: async () => null },
    '@/app/lib/permissions': { PERMISSIONS: { CASHBOOK_POST: 'cashbook:post' } },
  });
  const receipt = { bankCode: 'IZB', transactionId: 'IDC0A46191C9', description: 'Payment', noEntries: 1, creditAmount: 10, debitAmount: 10,
    entries: [{ entryNo: 1, referenceNo: 'IDC0A46191C9', customerNo: 'V1', noDetails: 1, amount: 10, currency: 'ZMW',
      details: [{ entryDescription: 'Payment', accountId: 'GL1', amount: 10, DrCr: 'Cr', detailNo: 1 }] }] };
  const legacy = load('idcbanksinegration/app/api/v1/cashbook/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    '../../../lib/cashbookService': { processCashbookReceipt: async receipt => { processed.push(receipt); return { success: true }; },
      isCashbookAlreadyProcessed: () => false, isCashbookProcessError: () => false },
    '../../../lib/cashbookContract': contract,
  });
  return { processed, audits, receipt, postLegacy: body => legacy.POST({ json: async () => body }),
    post: body => route.postCashbookTransaction({ headers: new Headers(), cookies: { get: () => ({ value: 'session' }) }, json: async () => body }) };
}

test('IZB references are mandatory, bounded strings and validation returns actionable caller errors', () => {
  for (const value of [undefined, null, '', '   ', '\t']) {
    const error = izbBankReferenceError(value);
    assert.equal(error.responseCode, 400); assert.equal(error.errorCode, 'BANK_REFERENCE_REQUIRED');
    assert.equal(error.field, 'bankReference'); assert.match(error.responseMessage, /keep transactionId unchanged/);
  }
  for (const value of [123, false, {}, [], 'X'.repeat(101), 'REF\n1', 'REF\x7f1']) {
    assert.equal(izbBankReferenceError(value).errorCode, 'INVALID_BANK_REFERENCE');
  }
  assert.equal(izbBankReferenceError('IZB-123'), null);
  assert.equal(izbBankReferenceError('X'.repeat(100)), null);
});

test('missing or invalid IZB success references return HTTP 400 without saving or updating anything', async () => {
  for (const bankReference of [undefined, null, '', '  ', 123, 'X'.repeat(101), 'REF\n1']) {
    const f = fixture(), response = await f.post({ ...f.receipt, bankReference });
    assert.equal(response.status, 400); assert.equal(response.body.field, 'bankReference');
    const legacy = await f.postLegacy({ ...f.receipt, bankReference });
    assert.equal(legacy.status, 400); assert.equal(legacy.body.field, 'bankReference');
    assert.equal(f.processed.length, 0); assert.equal(f.audits.length, 0);
  }
});

test('valid references are saved canonically and cannot be hidden by a nested bankResponse', async () => {
  const f = fixture();
  const response = await f.post({ ...f.receipt, bankReference: '  IZB-REF-123  ', bankResponse: { status: 'completed' } });
  assert.equal(response.status, 200); assert.equal(f.processed.length, 1);
  assert.equal(f.processed[0].bankReference, 'IZB-REF-123');
  assert.equal(f.processed[0].transactionId, f.receipt.transactionId);
});

test('historical receipts remain readable and non-IZB receipt contracts are unchanged', async () => {
  const f = fixture();
  assert.ok(contract.normalizeReceiptRequest(f.receipt), 'historical records can still be normalized');
  assert.equal((await f.post({ ...f.receipt, bankCode: 'ZICB' })).status, 200);
});
