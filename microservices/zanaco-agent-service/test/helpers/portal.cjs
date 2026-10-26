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

function routeFixture({ source = { accountNumber: '1234567890123', transit: '001', name: 'IDC' }, retry = false, savedRecords = [], memoryItems = [], registryEnabled = true } = {}) {
  const records = [], updates = [];
  const queueRecord = { queueId: 'old-queue', bankCode: 'ZANACO', status: 'failed' };
  let reservations = 0;
  class BankRegistryError extends Error { status = 409; }
  const route = load('idcbanksinegration/app/api/v1/posted_payments/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    '../../../lib/banks': { BANK_CODES: ['IZB', 'ZICB', 'ZANACO'] },
    '../../../lib/rbac': { requirePermission: async () => ({ id: 1, username: 'tester' }), isAuthError: () => false },
    '../../../lib/permissions': { PERMISSIONS: { PAYMENTS_POST: 'post' } },
    '../../../lib/auditLog': { logAuditEvent: async () => {} },
    '../../../lib/bankQueue': { enqueuePayment: (bankCode, payment, id) => ({ id, bankCode, payment, status: 'queued', attempts: 0 }),
      getAllQueueItems: () => memoryItems, getQueueItemsByBank: bank => memoryItems.filter(item => item.bankCode === bank) },
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
      findAll: async ({ where = {} } = {}) => savedRecords.filter(row => Object.entries(where).every(([key, value]) => row[key] === value)),
      update: async record => { updates.push(record); return [1]; },
    } },
    '@/app/lib/sourceAccounts': { resolveSourceBank: async () => source },
    '../../../lib/paymentPostGuard': { findExistingPaymentPost: async () => null, resolvePaymentId: (payment, fallback) => payment.paymentId || fallback },
    '../../../lib/banks/payloadBuilders': builders,
    '@/app/lib/bankIntegrations': { getBankIntegration: () => ({ dispatchStrategy: 'agent-pull' }) },
    '@/app/lib/zicb/ledger': { LedgerError: class extends Error {} },
    '@/app/lib/zicb/config': {},
    '@/app/lib/terminalLog': { terminalLog: () => {}, terminalError: () => {} },
    '@/app/lib/queueSearch': load('idcbanksinegration/app/lib/queueSearch.ts'),
    '@/app/lib/bankRegistry': { BankRegistryError, assertBankAcceptsPayments: async () => {
      if (registryEnabled === 'unavailable') throw new Error('Database unavailable');
      if (!registryEnabled) throw new BankRegistryError('This bank is not enabled for new payments');
    } },
  });
  return { records, updates, post: body => route.POST({ json: async () => body }),
    get: query => route.GET({ nextUrl: new URL(`http://portal/api/v1/posted_payments?${query}`), cookies: { get: () => ({ value: 'session' }) }, headers: { get: () => null } }) };
}

module.exports = { load, builders, routeFixture };
