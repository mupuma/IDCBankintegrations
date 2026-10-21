const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../../..');

function load(relative, mocks = {}) {
  const filename = path.join(root, relative);
  const module = new Module(filename);
  module.filename = filename;
  module.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = module.require.bind(module);
  module.require = id => Object.hasOwn(mocks, id) ? mocks[id] : original(id);
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, filename);
  return module.exports;
}
const builders = load('idcbanksinegration/app/lib/banks/payloadBuilders.ts');

function routeFixture({ source = { accountNumber: '1234567890123', transit: '001', name: 'IDC' }, retry = false } = {}) {
  const records = [], updates = [];
  const queueRecord = { queueId: 'old-queue', bankCode: 'ZANACO', status: 'failed' };
  let reservations = 0;
  const route = load('idcbanksinegration/app/api/v1/posted_payments/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    '../../../lib/banks': { BANK_CODES: ['IZB', 'ZICB', 'ZANACO'] },
    '../../../lib/rbac': { requirePermission: async () => ({ id: 1, username: 'tester' }), isAuthError: () => false },
    '../../../lib/permissions': { PERMISSIONS: { PAYMENTS_POST: 'post' } },
    '../../../lib/auditLog': { logAuditEvent: async () => {} },
    '../../../lib/bankQueue': { enqueuePayment: (bankCode, payment, id) => ({ id, bankCode, payment, status: 'queued', attempts: 0 }) },
    '../../../lib/db': { connectDatabase: async () => {}, getSequelize: async () => ({ transaction: fn => fn({}) }) },
    '@/app/models/internal/ZicbH2hPayment': { PaymentDispatchReservation: {
      create: async () => {
        if (retry && reservations++ === 0) throw Object.assign(new Error('Reserved'), { name: 'SequelizeUniqueConstraintError' });
      },
      findOne: async () => ({ queueId: 'old-queue' }),
    } },
    '../../../models/internal/PaymentQueueRequest': { PaymentQueueRequest: {
      create: async record => records.push(record),
      findOne: async () => queueRecord,
      update: async record => { updates.push(record); return [1]; },
    } },
    '@/app/lib/sourceAccounts': { resolveSourceBank: async () => source },
    '../../../lib/paymentPostGuard': { findExistingPaymentPost: async () => null, resolvePaymentId: (payment, fallback) => payment.paymentId || fallback },
    '../../../lib/banks/payloadBuilders': builders,
    '@/app/lib/bankIntegrations': { getBankIntegration: () => ({ dispatchStrategy: 'agent-pull' }) },
    '@/app/lib/zicb/ledger': { LedgerError: class extends Error {} },
    '@/app/lib/zicb/config': {},
    '@/app/lib/terminalLog': { terminalLog: () => {}, terminalError: () => {} },
  });
  return { records, updates, post: body => route.POST({ json: async () => body }) };
}

module.exports = { load, builders, routeFixture };
