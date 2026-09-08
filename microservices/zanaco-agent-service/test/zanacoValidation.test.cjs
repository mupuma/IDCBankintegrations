const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildZanacoRequest,
  validateZanacoPreparedRequest,
} = require('../dist/zanacoValidation');
const {
  prepareBulkPayload,
  validateBulkPayload,
} = require('../dist/bulk');

const basePayment = {
  paymentId: 'PAYMENT123456',
  accountNumber: '9876543210123',
  accountName: 'Alice Banda',
  amount: 125.5,
  currency: 'ZMW',
  transactionDate: '2099-01-01',
  transactionReference: 'REF1234567890',
  remarks: 'Supplier payment',
};

test('builds and validates Zanaco internal transfers', () => {
  const prepared = buildZanacoRequest({ ...basePayment, transactionType: 'INT' }, { accountNumber: '1234567890123' });
  assert.equal(prepared.service, 'ZANACO_INTERNAL');
  assert.equal(prepared.endpoint, '/zws-fcubs-service/api/v1/flex/fundsTransfer');
  assert.equal(prepared.request.bicCode, 'ZNCOZMLUXXX');
  assert.deepEqual(validateZanacoPreparedRequest(prepared), []);
});

test('uses current value date when source transaction date is historical', () => {
  const prepared = buildZanacoRequest(
    { ...basePayment, transactionType: 'INT', transactionDate: '2024-01-01' },
    { accountNumber: '1234567890123' },
  );
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(prepared.request.valueDate, today);
  assert.deepEqual(validateZanacoPreparedRequest(prepared), []);
});

test('requires DDAC sort code', () => {
  const prepared = buildZanacoRequest({ ...basePayment, transactionType: 'DDACCT', sortCode: '' }, { accountNumber: '1234567890123' });
  assert.match(validateZanacoPreparedRequest(prepared).join('\n'), /sortCode must be 6 digits/);
});

test('requires SWIFT regulatory fields', () => {
  const prepared = buildZanacoRequest({ ...basePayment, transactionType: 'TT', swiftCode: 'CHASUS33XXX' }, { accountNumber: '1234567890123' });
  const errors = validateZanacoPreparedRequest(prepared).join('\n');
  assert.match(errors, /tpin is required/);
  assert.match(errors, /purposeCode is required/);
  assert.match(errors, /sectorCode is required/);
});

test('validates bulk totals and item count', () => {
  const prepared = prepareBulkPayload('ZANACO_BULK_INTERNAL', {
    batchName: 'Payroll',
    currency: 'ZMW',
    totalCount: 2,
    totalAmount: 100,
    items: [
      {
        debitAccount: '1234567890123',
        creditAccount: '9876543210123',
        externalTranRef: 'BULKREF001',
        amount: 50,
        name: 'Alice Banda',
      },
    ],
  });
  const errors = validateBulkPayload(prepared).join('\n');
  assert.match(errors, /totalCount must match items length/);
  assert.match(errors, /totalAmount must equal/);
});
