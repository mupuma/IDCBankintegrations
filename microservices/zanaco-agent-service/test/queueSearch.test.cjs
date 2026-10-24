const test = require('node:test');
const assert = require('node:assert/strict');
const { load, routeFixture } = require('./helpers/portal.cjs');
const { matchesQueueSearch: matches } = load('idcbanksinegration/app/lib/queueSearch.ts');

const item = {
  id: 'queue-1', paymentId: 'IDC123456789', bankCode: 'IZB', sourceBank: '77050', status: 'failed',
  payment: { vendorId: 'S-0012-ZMW', accountName: 'TOTALENERGIES MARKETING ZAMBIA',
    transactionReference: 'FUEL-DEC-2025', transactionType: 'DDACCT', amount: 233010.73,
    currency: 'ZMW', remarks: 'Staff fuel payment' },
  response: { bankRef: 'BANK-REF-007' },
};

test('queue search matches vendor IDs and names case-insensitively and keeps fields separate', () => {
  assert.equal(matches(item, 'vendor', '  totalenergies  '), true);
  assert.equal(matches(item, 'vendor', 'S-0012'), true);
  assert.equal(matches(item, 'vendor', 'fuel'), false);
  assert.equal(matches(item, 'description', 'STAFF FUEL'), true);
  assert.equal(matches(item, 'reference', 'FUEL-DEC'), true);
  assert.equal(matches(item, 'reference', 'BANK-REF-007'), true);
  assert.equal(matches(item, 'reference', item.paymentId), true);
  assert.equal(matches(item, 'reference', item.id), true);
  assert.equal(matches(item, 'all', 'totalenergies'), true);
  assert.equal(matches(item, 'status', 'FAILED'), true);
  assert.equal(matches(item, 'amount', '233,010.73'), true);
  assert.equal(matches(item, 'amount', ','), false);
  assert.equal(matches(item, 'currency', 'zmw'), true);
  assert.equal(matches(item, 'sourceBank', '77050'), true);
  assert.equal(matches(item, 'all', ''), true);
  assert.equal(matches(item, 'vendor', '%'), false, 'search text is literal, not a SQL wildcard');
});

test('transaction-type search recognises portal and bank aliases, including bulk payments', () => {
  for (const actual of ['DDACCT', 'DDACC', 'DDAC']) for (const query of ['ddac', 'DDACC', 'ddacct']) {
    assert.equal(matches({ ...item, payment: { transactionType: actual } }, 'transactionType', query), true);
  }
  assert.equal(matches({ ...item, payment: { transactionType: 'TT' } }, 'transactionType', 'SWIFT'), true);
  assert.equal(matches({ ...item, payment: { transactionType: 'INT' } }, 'transactionType', 'internal'), true);
  const bulk = { ...item, bankCode: 'ZANACO', payment: { service: 'ZANACO_BULK_DDAC',
    meta: { paymentIds: ['CHILD-PAYMENT-1'] }, request: { batchName: 'PAYROLL-OCT', totalAmount: 100,
      items: [{ vendorId: 'V-099', name: 'Test Supplier', externalTranRef: 'CHILD-REF-1' }] } },
    response: { data: { response: { batchReference: 'ZANACO-BATCH-1' } } } };
  for (const reference of ['PAYROLL-OCT', 'CHILD-REF-1', 'CHILD-PAYMENT-1', 'ZANACO-BATCH-1']) assert.equal(matches(bulk, 'reference', reference), true);
  assert.equal(matches(bulk, 'vendor', 'test supplier'), true);
  assert.equal(matches(bulk, 'vendor', 'V-099'), true);
  assert.equal(matches(bulk, 'transactionType', 'DDACC'), true);
  assert.equal(matches(bulk, 'transactionType', 'RTGS'), false);
});

function row(n, overrides = {}) {
  return { id: n + 1, queueId: `queue-${n}`, paymentId: `IDC${n}`, bankCode: n % 2 ? 'IZB' : 'ZICB',
    sourceBank: '77050', status: 'failed', attempts: 1,
    paymentPayload: JSON.stringify({ vendorId: 'V001', accountName: n === 76 ? 'Distant Vendor' : 'Common Vendor', transactionType: 'RTGS' }),
    createdAt: new Date(2026, 0, 1), updatedAt: new Date(2026, 0, n + 1), ...overrides };
}

test('legacy service payloads can be found using their stored vendor and reference fields', () => {
  const legacy = { ...item, payment: { service: 'BNK9900', request: {
    beneName: 'Legacy Supplier', customerId: 'V-LEGACY', transferRef: 'OLD-REF-1',
    transferTyp: 'DDACC', amount: '100.50', payCurrency: 'ZMW', remarks: 'Old supplier payment',
  } } };
  for (const [field, query] of [['vendor', 'Legacy Supplier'], ['vendor', 'V-LEGACY'], ['reference', 'OLD-REF-1'],
    ['transactionType', 'DDACCT'], ['amount', '100.50'], ['currency', 'ZMW'], ['description', 'Old supplier']]) {
    assert.equal(matches(legacy, field, query), true, `${field}: ${query}`);
  }
});

test('API searches all saved payments before pagination and returns the matching total', async () => {
  const savedRecords = Array.from({ length: 81 }, (_, n) => row(n));
  const f = routeFixture({ savedRecords });
  const distant = await f.get('searchField=vendor&search=distant&page=1&pageSize=10');
  assert.equal(distant.status, 200);
  assert.equal(distant.body.total, 1);
  assert.equal(distant.body.items[0].id, 'queue-76');
  const secondPage = await f.get('searchField=vendor&search=common&page=2&pageSize=10');
  assert.equal(secondPage.body.total, 80);
  assert.equal(secondPage.body.items.length, 10);
  assert.equal(secondPage.body.page, 2);
  assert.equal((await f.get('page=1&pageSize=10')).body.total, 81);
});

test('API composes searches with bank/source filters and searches the authoritative saved row', async () => {
  const savedRecords = Array.from({ length: 81 }, (_, n) => row(n));
  const memoryItems = [{ ...item, id: 'queue-76', payment: { accountName: 'Obsolete Name' } }];
  const f = routeFixture({ savedRecords, memoryItems });
  assert.equal((await f.get('searchField=vendor&search=common&bankCode=IZB&page=1')).body.total, 40);
  assert.equal((await f.get('searchField=transactionType&search=rtgs&sourceBank=OTHER&page=1')).body.total, 0);
  assert.equal((await f.get('searchField=vendor&search=obsolete&page=1')).body.total, 0);
  assert.equal((await f.get('searchField=reference&search=IDC76&page=1')).body.total, 1);
  assert.equal((await f.get('searchField=vendor&search=missing&page=1')).body.total, 0);
});

test('API rejects invalid fields and oversized search strings', async () => {
  const f = routeFixture();
  assert.equal((await f.get('searchField=paymentPayload&search=x&page=1')).status, 400);
  assert.equal((await f.get('search=' + 'x'.repeat(201))).status, 400);
});
