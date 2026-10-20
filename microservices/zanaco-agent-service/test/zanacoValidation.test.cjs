const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildZanacoRequest,
  validateZanacoPreparedRequest,
  validateZanacoServicePayload,
} = require('../dist/zanacoValidation');
const {
  prepareBulkPayload,
  validateBulkPayload,
} = require('../dist/bulk');

test('direct payment service payloads reject omitted mandatory fields', () => {
  const errors = validateZanacoServicePayload({ service: 'ZANACO_RTGS', request: { debitAccount: '1234567890123', bicCode: 'INZAZMLUXXX' } });
  for (const field of ['creditAccount', 'externalTranRef', 'ccy', 'amount', 'valueDate', 'paymentDetails', 'name']) {
    assert.ok(errors.some(error => error.includes(`${field} is required`)), field);
  }
});

test('references use the complete stable identity and remain identical across retries', () => {
  const payment = { ...basePayment, transactionType: 'RTGS', swiftCode: 'INZAZMLUXXX' };
  const source = { accountNumber: '1234567890123' };
  const first = buildZanacoRequest({ ...payment, paymentId: 'PREFIX123456789012345-A' }, source);
  const second = buildZanacoRequest({ ...payment, paymentId: 'PREFIX123456789012345-B' }, source);
  assert.notEqual(first.externalTranRef, second.externalTranRef);
  assert.equal(first.externalTranRef, buildZanacoRequest({ ...payment, paymentId: 'PREFIX123456789012345-A' }, source).externalTranRef);
  assert.match(first.externalTranRef, /^[A-Z0-9]{16}$/);
});

test('portal and agent generate the same references for all single transfer types', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const Module = require('node:module');
  const ts = require('typescript');
  const filename = path.resolve(__dirname, '../../../idcbanksinegration/app/lib/banks/payloadBuilders.ts');
  const module = new Module(filename);
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
  for (const type of ['INT', 'RTGS', 'DDACCT', 'TT']) {
    const payment = { ...basePayment, transactionType: type };
    const source = { accountNumber: '1234567890123' };
    assert.equal(module.exports.buildZanacoPayload(payment, type, source).request.externalTranRef,
      buildZanacoRequest(payment, source).externalTranRef, type);
  }
});

const basePayment = {
  paymentId: 'PAYMENT123456',
  accountNumber: '9876543210123',
  accountName: 'Alice Banda',
  amount: 125.5,
  currency: 'ZMW',
  transactionDate: '2099-01-01',
  transactionReference: 'REF1234567890',
  remarks: 'Supplier payment',
  physicalAddress: { plotNo: '10', streetName: 'Cairo Road', town: 'Lusaka' },
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

test('requires 13-character debit account for single ZWS transfers', () => {
  const prepared = buildZanacoRequest({ ...basePayment, transactionType: 'RTGS', swiftCode: 'INZAZMLUXXX' }, { accountNumber: '123456789' });
  assert.match(validateZanacoPreparedRequest(prepared).join('\n'), /debitAccount must be exactly 13 characters/);
});

test('requires optional duplicatable external reference to meet spec length when supplied', () => {
  const prepared = buildZanacoRequest({
    ...basePayment,
    transactionType: 'TT',
    swiftCode: 'CHASUS33XXX',
    duplicatableExternalRef: 'short',
    tpin: '9632582410',
    purposeCode: '28501',
    sectorCode: 'K6411',
  }, { accountNumber: '1234567890123' });
  assert.match(validateZanacoPreparedRequest(prepared).join('\n'), /duplicatableExternalRef must be 36-105 characters/);
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

test('validates Nexus bulk account and reference constraints', () => {
  const prepared = prepareBulkPayload('ZANACO_BULK_DDAC', {
    batchName: 'Regional',
    description: 'x'.repeat(141),
    currency: 'ZMW',
    totalCount: 1,
    totalAmount: 50,
    items: [
      {
        debitAccount: '1234567890',
        creditAccount: '9876543210',
        externalTranRef: 'DDAC-REF-TOO-LONG-001',
        amount: 50,
        name: 'Alice Banda',
        sortCode: '040002',
      },
    ],
  });
  const errors = validateBulkPayload(prepared).join('\n');
  assert.match(errors, /description must be 140 characters or less/);
  assert.match(errors, /items\[0\]\.debitAccount must be 9 or 13 digits/);
  assert.match(errors, /items\[0\]\.creditAccount must be 9 or 13 digits/);
  assert.match(errors, /items\[0\]\.externalTranRef must be 16-20 characters/);
});
