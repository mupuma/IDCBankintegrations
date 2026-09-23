const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

process.env.ZICB_MOBILE_MONEY_TRANSFER_TYPE = 'MOBILE_MONEY';

require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, filename);

const { prepareZicbPayload } = require('../src/zicbAgent.ts');
const { validateZicbPayload } = require('../src/zicbValidation.ts');

const basePayment = {
  paymentId: 'SAGE-MM-1',
  vendorId: 'V001',
  amount: 125.5,
  currency: 'ZMW',
  transactionReference: 'MMREF001',
  remarks: 'Mobile payout',
  transactionDate: '2026-09-23',
  transactionType: 'MOBILE_MONEY',
  phoneNumber: '0973 849 272',
  accountNumber: '',
  accountName: 'Mobile Beneficiary',
  bankName: '',
  branchCode: '',
  sortCode: '',
  srcAcc: '0010066244206',
  srcBranch: '001',
  srcName: 'IDC Source',
};

test('agent builds a valid ZICB mobile-money payload from a payment', () => {
  const payload = prepareZicbPayload(basePayment);

  assert.equal(payload.service, 'BNK9900');
  assert.equal(payload.request.transferTyp, 'MOBILE_MONEY');
  assert.equal(payload.request.destAcc, '0973849272');
  assert.equal(payload.request.beneMobileNo, '0973849272');
  assert.equal(payload.request.destBranch, '');
  assert.deepEqual(validateZicbPayload(payload), []);
});

test('agent rejects mobile-money payloads without beneficiary mobile number', () => {
  const payload = {
    service: 'BNK9900',
    request: {
      userName: 'SageSystem',
      customerId: 'V001',
      ipAddress: '0.0.0.0',
      srcAcc: '0010066244206',
      destAcc: '',
      amount: 125.5,
      destCurrency: 'ZMW',
      srcCurrency: 'ZMW',
      payCurrency: 'ZMW',
      transferTyp: 'MOBILE_MONEY',
      srcBranch: '001',
      remarks: 'Mobile payout',
      payDate: '2026-09-23',
      senderName: 'IDC Source',
    },
  };

  assert.ok(validateZicbPayload(payload).includes('request.beneMobileNo is required for mobile money'));
});
