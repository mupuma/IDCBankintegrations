const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/portal.cjs');
const { bankResponseReferences } = load('idcbanksinegration/app/lib/bankResponseDetails.ts');

test('transaction lines find references across bank callbacks, reports and nested bulk responses', () => {
  const refs = bankResponseReferences({ bankRef: 'ZICB-1', bankCallback: { bankRef: 'ZICB-1', prcn_number: 'IDC-2026-00001' },
    bankReport: { details: { bankResponse: { transactions: [{ tranRefNo: 'TXN-1' }] } } },
    bankNotification: { bankResponse: { bankReference: 'IZB-1' } }, response: { batchReference: 'BULK-1' } });
  assert.equal(refs.filter(ref => ref.value === 'ZICB-1').length, 1);
  for (const value of ['ZICB-1', 'IDC-2026-00001', 'TXN-1', 'IZB-1', 'BULK-1']) assert.ok(refs.some(ref => ref.value === value));
  assert.deepEqual(bankResponseReferences(null), []);
});
