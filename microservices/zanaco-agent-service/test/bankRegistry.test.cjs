const test = require('node:test');
const assert = require('node:assert/strict');
const { load, routeFixture } = require('./helpers/portal.cjs');
const root = 'idcbanksinegration/app/';
const catalog = load(root + 'lib/bankCatalog.ts');
const contract = load('shared/bank-agent-v1/index.ts');

function fixture() {
  const rows = new Map(), audit = [];
  let tail = Promise.resolve(), administrator = true, seeds = 0;
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const db = { transaction: fn => {
    const result = tail.then(() => fn(transaction)); tail = result.catch(() => {}); return result;
  } };
  const model = {
    findOrCreate: async ({ where, defaults }) => {
      seeds++;
      if (rows.has(where.bankCode)) return [rows.get(where.bankCode), false];
      const row = { ...defaults, update: async function (values, options) {
        assert.equal(options.transaction, transaction); Object.assign(this, values);
      } };
      rows.set(row.bankCode, row); return [row, true];
    },
    findAll: async () => [...rows.values()],
    findByPk: async (code, options) => { if (options) assert.equal(options.lock, 'UPDATE'); return rows.get(code); },
  };
  const service = () => load(root + 'lib/bankRegistry.ts', {
    './db': { connectDatabase: async () => {}, getSequelize: async () => db },
    '@/app/models/internal/BankIntegration': { BankIntegration: model }, './bankCatalog': catalog,
  });
  const registry = service();
  const route = load(root + 'api/v1/bank_integrations/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    '@/app/lib/rbac': { requirePermission: async (_req, permission) => permission === 'manage' && !administrator ? { denied: true, status: 403 } : { id: 1, username: 'admin' }, isAuthError: value => value.denied },
    '@/app/lib/permissions': { PERMISSIONS: { BANK_INTEGRATIONS_MANAGE: 'manage', PAYMENTS_READ: 'read' } },
    '@/app/lib/bankRegistry': registry,
    '@/app/lib/auditLog': { logAuditEvent: async value => audit.push(value) },
  });
  return { registry, rows, audit, service, seeds: () => seeds, operator: () => { administrator = false; },
    post: body => route.POST({ json: async () => body }), patch: body => route.PATCH({ json: async () => body }),
    get: admin => route.GET({ nextUrl: new URL(`http://portal/api/v1/bank_integrations?administration=${admin}`) }) };
}

test('registry seeds existing adapters once and preserves names and disabled banks across restarts', async () => {
  const f = fixture();
  const [first, second] = await Promise.all([f.registry.listBankIntegrations(), f.registry.listBankIntegrations()]);
  assert.equal(first.length, 3); assert.deepEqual(first, second); assert.equal(f.seeds(), 3);
  assert.equal(first.every(bank => bank.enabled && bank.status === 'ready'), true);
  const updated = await f.registry.updateBankRegistration({ bankCode: 'IZB', displayName: 'My IZB', enabled: false, revision: 1 });
  assert.equal(updated.revision, 2);
  const restarted = f.service();
  const items = await restarted.listBankIntegrations();
  assert.equal(items.find(bank => bank.bankCode === 'IZB').displayName, 'My IZB');
  assert.equal(items.find(bank => bank.bankCode === 'IZB').enabled, false);
  await assert.rejects(restarted.assertBankAcceptsPayments('IZB'), /not enabled/);
  await restarted.assertBankAcceptsPayments('ZICB');
});

test('unknown banks remain non-executable drafts and cannot be enabled by editing configuration', async () => {
  const f = fixture();
  const draft = await f.registry.createBankDraft({ bankCode: 'NEW_BANK', displayName: 'New Bank' });
  assert.equal(draft.status, 'draft'); assert.equal(draft.enabled, false);
  assert.deepEqual(draft.transactionTypes, []);
  assert.equal((await f.registry.listBankIntegrations()).some(bank => bank.bankCode === 'NEW_BANK'), false);
  assert.equal((await f.registry.listBankIntegrations(true)).length, 4);
  await assert.rejects(f.registry.updateBankRegistration({ bankCode: 'NEW_BANK', displayName: 'New Bank', enabled: true, revision: 1 }), /compatible agent/);
  await assert.rejects(f.registry.assertBankAcceptsPayments('NEW_BANK'), /not enabled/);
  await assert.rejects(f.registry.createBankDraft({ bankCode: 'IZB', displayName: 'Replacement' }), /already exists/);
  await assert.rejects(f.registry.createBankDraft({ bankCode: 'BAD/URL', displayName: 'Invalid' }), /Bank code/);
  await assert.rejects(f.registry.createBankDraft({ bankCode: 'BANK2', displayName: 'Bank', clientSecret: 'secret' }), /Only bank code/);
});

test('stale and concurrent administrator changes cannot overwrite a newer registration', async () => {
  const f = fixture(); await f.registry.listBankIntegrations();
  const changes = await Promise.allSettled([false, true].map(enabled => f.registry.updateBankRegistration({ bankCode: 'ZICB', displayName: 'ZICB', enabled, revision: 1 })));
  assert.equal(changes.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(changes.filter(result => result.status === 'rejected').length, 1);
  assert.equal(f.rows.get('ZICB').revision, 2);
  await assert.rejects(f.registry.updateBankRegistration({ bankCode: 'ZICB', displayName: 'ZICB', enabled: true, revision: 1 }), /another administrator/);
});

test('operators can read bank availability but only administrators can manage or list drafts', async () => {
  const f = fixture();
  assert.equal((await f.post({ bankCode: 'EXAMPLE', displayName: 'Example Bank' })).status, 201);
  assert.equal(f.audit[0].action, 'BANK_INTEGRATION_CREATED');
  assert.equal((await f.patch({ bankCode: 'IZB', displayName: 'IZB', enabled: false, revision: 1 })).status, 200);
  assert.equal(f.audit.at(-1).action, 'BANK_INTEGRATION_UPDATED');
  f.operator();
  assert.equal((await f.get(false)).status, 200);
  assert.equal((await f.get(false)).body.items.length, 3);
  assert.equal((await f.get(true)).status, 403);
  assert.equal((await f.post({ bankCode: 'BLOCKED', displayName: 'Blocked' })).status, 403);
  assert.equal((await f.patch({ bankCode: 'IZB', displayName: 'IZB', enabled: true, revision: 2 })).status, 403);
});

test('disabled banks and unavailable registry block single and bulk submissions before queue creation', async () => {
  for (const registryEnabled of [false, 'unavailable']) {
    for (const body of [
      { bankCode: 'IZB', payment: { paymentId: 'SAGE1', amount: 100 } },
      { bankCode: 'ZANACO', payments: [{ paymentId: 'SAGE1', amount: 100 }] },
      { bankCode: 'ZICB', payment: { paymentId: 'SAGE1', amount: 100 } },
    ]) {
      const f = routeFixture({ registryEnabled });
      const result = await f.post(body);
      assert.equal(result.status, registryEnabled === false ? 409 : 503);
      assert.equal(f.records.length, 0); assert.equal(f.updates.length, 0);
    }
  }
});

test('agent manifest contract rejects unsupported versions and embedded credential values', () => {
  const manifest = { protocol: contract.BANK_AGENT_PROTOCOL, bankCode: 'EXAMPLE', displayName: 'Example Bank', agentVersion: '1.0.0',
    transactionTypes: ['RTGS'], operations: ['submit', 'validate', 'status', 'report'],
    configuration: [{ key: 'CLIENT_SECRET', label: 'Client secret', type: 'secret', required: true }] };
  assert.deepEqual(contract.validateManifest(manifest), []);
  assert.ok(contract.validateManifest({ ...manifest, protocol: 'bank-agent/v99' }).length);
  assert.ok(contract.validateManifest({ ...manifest, configuration: [{ ...manifest.configuration[0], value: 'do-not-expose' }] }).length);
  assert.ok(contract.validateManifest({ ...manifest, configuration: [manifest.configuration[0], manifest.configuration[0]] }).length);
  assert.ok(contract.validateManifest({ ...manifest, transactionTypes: [] }).length);
});

test('legacy posting endpoint also rejects disabled registrations', async () => {
  const f = fixture(); await f.registry.listBankIntegrations();
  await f.registry.updateBankRegistration({ bankCode: 'IZB', displayName: 'IZB', enabled: false, revision: 1 });
  let writes = 0;
  const route = load(root + 'api/v1/sage_posted_payments/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    '../../../lib/banks': { BANK_CODES: ['IZB', 'ZICB', 'ZANACO'] },
    '../../auth/login/middleware/auth': { verifySessionToken: async () => ({ username: 'operator' }) },
    '../../../lib/bankQueue': {}, '../../../lib/db': {}, '../../../lib/paymentPostGuard': {},
    '../../../models/internal/PaymentQueueRequest': { PaymentQueueRequest: { create: async () => { writes++; } } },
    '@/app/lib/bankRegistry': f.registry,
  });
  const result = await route.POST({ cookies: { get: () => ({ value: 'session' }) }, json: async () => ({ bankCode: 'IZB', payment: { paymentId: 'SAGE1' } }) });
  assert.equal(result.status, 409); assert.equal(writes, 0);
});

test('actual role permissions reserve integration administration for administrators', () => {
  const permissions = load(root + 'lib/permissions.ts');
  const permission = permissions.PERMISSIONS.BANK_INTEGRATIONS_MANAGE;
  assert.equal(permissions.roleHasPermission('ADMIN', permission), true);
  assert.equal(permissions.roleHasPermission('OPERATOR', permission), false);
  assert.equal(permissions.roleHasPermission('VIEWER', permission), false);
});
