const test = require('node:test');
const assert = require('node:assert/strict');
const { builders: portal, routeFixture } = require('./helpers/portal.cjs');
const { prepareZanacoServicePayload, prepareZanacoPayload } = require('../dist/zanacoAgent');
const { validateBulkPayload, prepareBulkPayload } = require('../dist/bulk');

const source = { accountNumber: '1234567890123', transit: '001', name: 'IDC' };
const payment = {
  paymentId: 'SAGE1', transactionType: 'RTGS', transactionReference: 'INV1', amount: 125.5,
  currency: 'ZMW', transactionDate: '2099-01-01', remarks: 'Supplier payment',
  accountNumber: '9876543210123', accountName: 'Alice Banda', bankName: 'Beneficiary Bank',
  swiftCode: 'INZAZMLUXXX', sortCode: '040002',
  physicalAddress: { plotNo: '10', streetName: 'Cairo Road', town: 'Lusaka' },
  tpin: '9632582410', purposeCode: '28501', sectorCode: 'K6411',
};
const body = row => ({ bankCode: 'ZANACO', sourceBank: 'SOURCE1', payment: row });
const bulkBody = rows => ({ bankCode: 'ZANACO', sourceBank: 'SOURCE1', transactionType: 'RTGS', payments: rows });

test('screen validation accepts all supported types and agent accepts the same payloads', () => {
  for (const type of ['INT', 'RTGS', 'DDACCT', 'DDAC', 'TT', 'SWIFT']) {
    const row = { ...payment, transactionType: type };
    assert.deepEqual(portal.validateZanacoPaymentSelection(row, type, source), { valid: true, errors: [] }, type);
    assert.doesNotThrow(() => prepareZanacoServicePayload(portal.buildZanacoPayload(row, type, source)), type);
  }
});

test('screen validation rejects missing source, beneficiary name and real address', () => {
  assert.match(portal.validateZanacoPaymentSelection(payment, 'RTGS').errors.join(), /Source account/);
  assert.equal(portal.validateZanacoPaymentSelection(payment, 'RTGS', {}).valid, false);
  for (const changes of [{ accountName: '' }, { physicalAddress: {} }]) {
    const row = { ...payment, ...changes };
    assert.equal(portal.validateZanacoPaymentSelection(row, 'RTGS', source).valid, false);
    assert.throws(() => prepareZanacoPayload({ ...row, srcAcc: source.accountNumber }));
  }
});

test('portal rejects impossible/past payload dates and invalid source dates without hiding them', () => {
  for (const valueDate of ['2099-02-30', '2099-13-01', '2020-01-01', 'not-a-date']) {
    const payload = portal.buildZanacoPayload(payment, 'RTGS', source);
    payload.request.valueDate = valueDate;
    assert.match(portal.validateZanacoPayload(payload).join(), /valueDate/);
    assert.throws(() => prepareZanacoServicePayload(payload));
  }
  for (const transactionDate of ['2099-02-30', 'not-a-date']) {
    assert.equal(portal.validateZanacoPaymentSelection({ ...payment, transactionDate }, 'RTGS', source).valid, false);
  }
  assert.equal(portal.validateZanacoPaymentSelection({ ...payment, transactionDate: '2020-01-01' }, 'RTGS', source).valid, true);
});

test('payload checks enforce account lengths, field lengths, currency and positive amounts', () => {
  for (const [field, value] of [
    ['creditAccount', '1'.repeat(21)], ['debitAccount', '123'], ['name', 'x'.repeat(106)],
    ['paymentDetails', 'x'.repeat(106)], ['address', 'x'.repeat(106)], ['bicCode', 'X'.repeat(12)],
    ['ccy', 'zmw'], ['amount', 0], ['amount', -1], ['amount', 'NaN'], ['amount', true], ['amount', [125.5]],
  ]) {
    const payload = portal.buildZanacoPayload(payment, 'RTGS', source);
    payload.request[field] = value;
    assert.ok(portal.validateZanacoPayload(payload).length, field);
    assert.throws(() => prepareZanacoServicePayload(payload), field);
  }
});

test('DDACC and SWIFT mandatory fields are enforced', () => {
  for (const sortCode of ['', '04002', 'ABCDEF']) {
    assert.equal(portal.validateZanacoPaymentSelection({ ...payment, sortCode, branchCode: '' }, 'DDACCT', source).valid, false);
  }
  for (const field of ['tpin', 'purposeCode', 'sectorCode', 'swiftCode']) {
    assert.equal(portal.validateZanacoPaymentSelection({ ...payment, [field]: '' }, 'TT', source).valid, false, field);
  }
  assert.equal(portal.validateZanacoPaymentSelection(payment, 'BADTYPE', source).valid, false);
});

test('validated bank and regulatory fields are trimmed in the actual outgoing payload', () => {
  const row = { ...payment, swiftCode: ` ${payment.swiftCode} `, sortCode: ` ${payment.sortCode} `,
    tpin: ` ${payment.tpin} `, purposeCode: ` ${payment.purposeCode} `, sectorCode: ` ${payment.sectorCode} ` };
  for (const type of ['RTGS', 'DDACCT', 'TT']) {
    const payload = portal.buildZanacoPayload(row, type, source);
    assert.deepEqual(portal.validateZanacoPayload(payload), []);
    for (const field of ['bicCode', 'sortCode', 'tpin', 'purposeCode', 'sectorCode']) {
      if (payload.request[field]) assert.equal(payload.request[field], payment[field === 'bicCode' ? 'swiftCode' : field]);
    }
  }
});

test('single POST rejects invalid payments before creating queue records', async () => {
  for (const changes of [
    { accountNumber: '1'.repeat(21) }, { accountName: 'x'.repeat(106) }, { amount: 0 }, { amount: true }, { currency: '' }, { paymentId: '' },
    { swiftCode: '' }, { physicalAddress: {} }, { transactionDate: '2099-02-30' }, { transactionType: 'BADTYPE' },
  ]) {
    const f = routeFixture();
    const response = await f.post(body({ ...payment, ...changes }));
    assert.equal(response.status, 400, JSON.stringify(changes));
    assert.equal(f.records.length, 0);
  }
});

test('single POST requires a selected, complete source account', async () => {
  for (const source of [null, {}]) {
    const f = routeFixture({ source });
    assert.equal((await f.post(body(payment))).status, 400);
    assert.equal(f.records.length, 0);
  }
  const f = routeFixture();
  assert.equal((await f.post({ ...body(payment), sourceBank: null })).status, 400);
  assert.equal(f.records.length, 0);
});

test('valid single POST and failed-reservation retry preserve validated debit details for agent-pull', async () => {
  for (const [type, retry] of [['INT', false], ['RTGS', false], ['DDACCT', false], ['DDAC', false], ['TT', false], ['SWIFT', false], ['RTGS', true]]) {
    const f = routeFixture({ retry });
    const response = await f.post(body({ ...payment, transactionType: type }));
    assert.equal(response.status, 200);
    const record = retry ? f.updates[0] : f.records[0];
    const queued = JSON.parse(record.paymentPayload);
    assert.equal(queued.srcAcc, source.accountNumber);
    assert.doesNotThrow(() => prepareZanacoPayload(queued));
  }
});

test('bulk POST rejects unsupported types, duplicate IDs, mixed currencies and mixed dates', async () => {
  const second = { ...payment, paymentId: 'SAGE2' };
  const cases = [
    bulkBody([payment, payment]),
    bulkBody([payment, { ...second, paymentId: '' }]),
    bulkBody([payment, { ...second, currency: 'USD' }]),
    bulkBody([payment, { ...second, transactionDate: '2099-01-02' }]),
    { ...bulkBody([payment, second]), transactionType: 'BADTYPE', payments: [{ ...payment, transactionType: 'BADTYPE' }, { ...second, transactionType: 'BADTYPE' }] },
    bulkBody([payment, null]),
    bulkBody(Array.from({ length: 1001 }, (_, index) => ({ ...payment, paymentId: `SAGE${index}` }))),
    bulkBody([payment, { ...second, accountNumber: '12345678901234567890' }]),
  ];
  for (const request of cases) {
    const f = routeFixture();
    const response = await f.post(request);
    assert.equal(response.status, 400, JSON.stringify(response.body));
    assert.equal(f.records.length, 0);
  }
});

test('valid bulk POST queues one batch accepted by agent validation', async () => {
  const f = routeFixture();
  const response = await f.post(bulkBody([payment, { ...payment, paymentId: 'SAGE2' }]));
  assert.equal(response.status, 202, JSON.stringify(response.body));
  assert.equal(f.records.length, 1);
  const queued = JSON.parse(f.records[0].paymentPayload);
  assert.deepEqual(validateBulkPayload(prepareBulkPayload(queued.service, queued.request)), []);
  assert.equal(queued.request.totalAmount, 251);
});

test('portal and agent bulk validators agree on totals, account formats and duplicate references', () => {
  const request = { batchName: 'Test', currency: 'ZMW', totalCount: 2, totalAmount: 20,
    items: [1, 2].map(id => ({ debitAccount: source.accountNumber, creditAccount: payment.accountNumber, name: 'Alice', amount: 10, externalTranRef: `REF${id}`, bicCode: payment.swiftCode })) };
  for (const change of [
    {}, { totalCount: 1 }, { totalAmount: 999 }, { items: [null] },
    { items: [request.items[0], request.items[0]] },
    { items: [request.items[0], { ...request.items[1], creditAccount: 'x'.repeat(20) }] },
  ]) {
    const value = { ...request, ...change };
    assert.deepEqual(portal.validateZanacoBulkPayload({ service: 'ZANACO_BULK_RTGS', request: value }),
      validateBulkPayload(prepareBulkPayload('ZANACO_BULK_RTGS', value)));
  }
});
