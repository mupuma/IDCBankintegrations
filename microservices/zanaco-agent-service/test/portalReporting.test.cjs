const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function fixture(status) {
  const row = { status, bankCode: 'ZANACO', paymentPayload: '{}' };
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  let writes = 0;
  const mocks = {
    sequelize: { QueryTypes: {}, Transaction: {} },
    '@/app/lib/db': { connectDatabase: async () => {}, getSequelize: async () => ({ transaction: fn => fn(transaction) }) },
    '@/app/models/internal/PaymentQueueRequest': { PaymentQueueRequest: {
      findOne: async options => { assert.equal(options.transaction, transaction); assert.equal(options.lock, 'UPDATE'); return row; },
      update: async (values, options) => { assert.equal(options.transaction, transaction); writes++; Object.assign(row, values); return [1]; },
    } },
  };
  const filename = path.resolve(__dirname, '../../../idcbanksinegration/app/lib/agentQueue.ts');
  const module = new Module(filename);
  module.require = id => { if (!mocks[id]) throw new Error(`Unexpected dependency ${id}`); return mocks[id]; };
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return { report: module.exports.reportBankQueueResult, row, writes: () => writes };
}

test('late uncertain or failure reports cannot downgrade confirmed Zanaco settlement', async () => {
  for (const settled of ['success', 'paid']) {
    const f = fixture(settled);
    for (const status of ['processing', 'unknown', 'failed', 'accepted', 'queued']) {
      assert.equal(await f.report('queue1', { status }), true);
      assert.equal(f.row.status, settled);
    }
    assert.equal(f.writes(), 0);
  }
});

test('unknown and accepted outcomes remain unresolved until a success report arrives', async () => {
  const f = fixture('processing');
  for (const status of ['accepted', 'unknown', 'success']) {
    await f.report('queue1', { status });
    assert.equal(f.row.status, status);
  }
  assert.equal(f.writes(), 3);
});
