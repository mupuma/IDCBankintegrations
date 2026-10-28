const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { load } = require('./helpers/portal.cjs');
const contract = load('shared/bank-agent-v1/index.ts');
class BankRegistryError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const errors = { BankRegistryError };
const core = load('idcbanksinegration/app/lib/agentConfiguration.ts', {
  '../../../shared/bank-agent-v1': contract, './bankRegistry': errors,
});
const token = 'dedicated_agent_token_for_onboarding_123456';
const manifest = { protocol: 'bank-agent/v1', bankCode: 'DEMO', displayName: 'Demo bank', agentVersion: '1.0',
  transactionTypes: ['RTGS'], operations: ['validate'], configuration: [
    { key: 'CLIENT_SECRET', label: 'Client secret', type: 'secret', required: true },
    { key: 'API_URL', label: 'API URL', type: 'url', required: true },
    { key: 'LIMIT', label: 'Limit', type: 'integer', required: false },
    { key: 'ACTIVE', label: 'Active', type: 'boolean', required: false },
  ] };
const values = { CLIENT_SECRET: 'bank-secret-value', API_URL: 'https://bank.example/api', LIMIT: 10, ACTIVE: false };
function environment() {
  process.env.BANK_AGENT_CONFIG_KEY = Buffer.alloc(32, 7).toString('base64');
  process.env.BANK_AGENT_ALLOWED_ORIGINS = 'https://agent.example';
  delete process.env.BANK_AGENT_ALLOW_LOOPBACK_HTTP;
  delete process.env.BANK_AGENT_TRUST_PROXY;
}
function fixture() {
  environment();
  const rows = new Map(), bank = { bankCode: 'DEMO', adapter: 'agent-v1', enabled: false };
  let tail = Promise.resolve();
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const db = { transaction(fn) { const result = tail.then(() => fn(transaction)); tail = result.catch(() => {}); return result; } };
  const service = load('idcbanksinegration/app/lib/agentOnboarding.ts', {
    './db': { connectDatabase: async () => {}, getSequelize: async () => db },
    '@/app/models/internal/BankIntegration': { BankIntegration: { findByPk: async (code, options) => {
      if (options) assert.equal(options.lock, 'UPDATE'); return code === 'DEMO' ? bank : null;
    } } },
    '@/app/models/internal/BankAgentProfile': { BankAgentProfile: {
      findByPk: async code => rows.get(code) || null,
      create: async (values, options) => { assert.equal(options.transaction, transaction);
        const row = { ...values, update: async function (values, options) { assert.equal(options.transaction, transaction); Object.assign(this, values); } };
        rows.set(row.bankCode, row); return row;
      },
    } },
    './bankRegistry': errors,
    './agentConfiguration': { ...core, discoverAgent: async () => ({ agentUrl: 'https://agent.example', manifest }) },
  });
  return { rows, bank, service, discover: revision => service.saveAgentProfile({ action: 'discover', bankCode: 'DEMO', revision, agentUrl: 'https://agent.example', token }),
    configure: (revision, configuration = values) => service.saveAgentProfile({ action: 'configure', bankCode: 'DEMO', revision, configuration }) };
}

test('AES-GCM binds ciphertext to the bank and purpose and fails closed on corruption or wrong key', () => {
  environment();
  const first = core.encryptAgentValue('DEMO', 'configuration', values), second = core.encryptAgentValue('DEMO', 'configuration', values);
  assert.notEqual(first, second); assert.equal(first.includes(values.CLIENT_SECRET), false);
  assert.deepEqual(core.decryptAgentValue('DEMO', 'configuration', first), values);
  assert.throws(() => core.decryptAgentValue('OTHER', 'configuration', first));
  assert.throws(() => core.decryptAgentValue('DEMO', 'token', first));
  const parts = first.split('.'); parts[3] = Buffer.from('corrupted').toString('base64');
  assert.throws(() => core.decryptAgentValue('DEMO', 'configuration', parts.join('.')));
  process.env.BANK_AGENT_CONFIG_KEY = randomBytes(32).toString('base64');
  assert.throws(() => core.decryptAgentValue('DEMO', 'configuration', first));
  delete process.env.BANK_AGENT_CONFIG_KEY;
  assert.throws(() => core.encryptAgentValue('DEMO', 'token', token), /BANK_AGENT_CONFIG_KEY/);
});

test('discovery only sends tokens to explicitly allowed HTTPS origins without redirects', async () => {
  environment();
  for (const url of ['http://agent.example', 'https://evil.example', 'https://agent.example/path', 'https://user:password@agent.example', 'https://agent.example/?token=x']) assert.throws(() => core.allowedAgentUrl(url));
  const original = global.fetch; let calls = 0;
  try {
    global.fetch = async (url, options) => { calls++; assert.equal(url, 'https://agent.example/v1/manifest');
      assert.equal(options.redirect, 'error'); assert.equal(options.headers.Authorization, `Bearer ${token}`);
      return new Response(JSON.stringify(manifest));
    };
    assert.equal((await core.discoverAgent('DEMO', 'https://agent.example', token)).manifest.bankCode, 'DEMO');
    await assert.rejects(core.discoverAgent('OTHER', 'https://agent.example', token), /discovery failed/);
    await assert.rejects(core.discoverAgent('DEMO', 'https://evil.example', token));
    assert.equal(calls, 2);
    global.fetch = async () => new Response('x'.repeat(32769));
    await assert.rejects(core.discoverAgent('DEMO', 'https://agent.example', token), /discovery failed/);
    global.fetch = async () => { throw new Error(`sensitive ${token}`); };
    await assert.rejects(core.discoverAgent('DEMO', 'https://agent.example', token), error => !error.message.includes(token));
  } finally { global.fetch = original; }
});

test('configuration validates declared types, preserves omitted fields and rejects unknown or invalid fields', () => {
  environment();
  const result = core.validateConfiguration(manifest, { CLIENT_SECRET: 'changed' }, values);
  assert.equal(result.ACTIVE, false); assert.equal(result.CLIENT_SECRET, 'changed');
  assert.equal(core.validateConfiguration(manifest, { LIMIT: null }, values).LIMIT, undefined);
  for (const input of [{}, { ...values, LIMIT: 1.5 }, { ...values, ACTIVE: 'false' }, { ...values, API_URL: 'http://bank' }, { ...values, UNKNOWN: 'x' }, { ...values, CLIENT_SECRET: null }]) assert.throws(() => core.validateConfiguration(manifest, input));
});

test('onboarding stores encrypted data, browser summaries contain no values, agent delivery is bank scoped', async () => {
  const f = fixture();
  assert.equal((await f.service.readAgentProfile('DEMO')).revision, 0);
  assert.equal((await f.discover(0)).configured, false);
  const saved = await f.configure(1);
  assert.equal(saved.revision, 2); assert.equal(saved.configured, true);
  const persisted = JSON.stringify([...f.rows.values()]);
  assert.equal(persisted.includes(token), false); assert.equal(persisted.includes(values.CLIENT_SECRET), false);
  const browser = JSON.stringify(await f.service.readAgentProfile('DEMO'));
  assert.equal(browser.includes(values.CLIENT_SECRET), false); assert.equal(browser.includes(values.API_URL), false);
  assert.deepEqual((await f.service.deliverAgentConfiguration('DEMO', token)).configuration, values);
  await assert.rejects(f.service.deliverAgentConfiguration('DEMO', 'wrong'), error => error.status === 401);
  await assert.rejects(f.service.deliverAgentConfiguration('OTHER', token), error => error.status === 401);
  await f.configure(2, { LIMIT: 99 });
  assert.equal((await f.service.deliverAgentConfiguration('DEMO', token)).configuration.CLIENT_SECRET, values.CLIENT_SECRET);
});

test('concurrent changes reject stale revisions, rediscovery clears configuration, builtins cannot be reconfigured', async () => {
  const f = fixture(); await f.discover(0);
  const results = await Promise.allSettled([f.configure(1), f.configure(1)]);
  assert.equal(results.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(results.find(item => item.status === 'rejected').reason.status, 409);
  await f.discover(2);
  await assert.rejects(f.service.deliverAgentConfiguration('DEMO', token), error => error.status === 409);
  f.bank.adapter = 'izb-pull';
  await assert.rejects(f.discover(3), /environment configuration/);
});

test('admin endpoints enforce permission, never audit secrets and return safe errors', async () => {
  const f = fixture(), audit = []; let allowed = false;
  const route = load('idcbanksinegration/app/api/v1/bank_integrations/agent/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, ...options, status: options?.status || 200 }) } },
    '@/app/lib/rbac': { requirePermission: async () => allowed ? { id: 1, username: 'admin' } : { denied: true, status: 403 }, isAuthError: value => value.denied },
    '@/app/lib/permissions': { PERMISSIONS: { BANK_INTEGRATIONS_MANAGE: 'manage' } },
    '@/app/lib/bankRegistry': errors, '@/app/lib/agentOnboarding': f.service,
    '@/app/lib/auditLog': { logAuditEvent: async value => audit.push(value) },
  });
  const request = body => ({ text: async () => JSON.stringify(body), nextUrl: new URL('https://portal/api?bankCode=DEMO') });
  assert.equal((await route.GET(request())).status, 403);
  assert.equal((await route.POST(request({}))).status, 403);
  allowed = true;
  const discovered = await route.POST(request({ action: 'discover', bankCode: 'DEMO', revision: 0, token, agentUrl: 'https://agent.example' }));
  assert.equal(discovered.status, 200);
  assert.equal((await route.POST(request({ action: 'configure', bankCode: 'DEMO', revision: 1, configuration: values }))).status, 200);
  assert.equal(JSON.stringify(audit).includes(values.CLIENT_SECRET), false);
  assert.equal(JSON.stringify(audit).includes(token), false);
  assert.equal((await route.POST({ text: async () => 'x'.repeat(65537) })).status, 413);
});

test('agent configuration endpoint requires HTTPS and scoped bearer credentials, and prevents caching', async () => {
  const f = fixture(); await f.discover(0); await f.configure(1);
  const route = load('idcbanksinegration/app/api/v1/agents/configuration/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, ...options, status: options?.status || 200 }) } },
    '@/app/lib/bankRegistry': errors, '@/app/lib/agentOnboarding': f.service,
  });
  const request = (url, auth = `Bearer ${token}`, bankCode = 'DEMO', proto = 'https') => ({ nextUrl: new URL(url), headers: new Headers({ authorization: auth, 'x-bank-code': bankCode, 'x-forwarded-proto': proto }) });
  assert.equal((await route.GET(request('http://portal'))).status, 403);
  assert.equal((await route.GET(request('https://portal', 'Bearer wrong'))).status, 401);
  assert.equal((await route.GET(request('https://portal', `Bearer ${token}`, 'OTHER'))).status, 401);
  const result = await route.GET(request('https://portal'));
  assert.equal(result.status, 200); assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.deepEqual(result.body.configuration, values);
});

test('reference agent manifest endpoint checks bearer token and exposes metadata only', () => {
  const { manifestHandler } = require('../../../shared/bank-agent-v1/runtime.cjs');
  const handler = manifestHandler({ manifest, token });
  function invoke(authorization, method = 'GET', url = '/v1/manifest') {
    const result = {}; handler({ headers: { authorization }, method, url }, {
      setHeader() {}, writeHead(status) { result.status = status; }, end(body) { result.body = JSON.parse(body); },
    }); return result;
  }
  assert.equal(invoke('Bearer wrong').status, 401);
  assert.equal(invoke(`Bearer ${token}`, 'POST').status, 404);
  assert.deepEqual(invoke(`Bearer ${token}`).body, manifest);
  assert.throws(() => manifestHandler({ manifest, token: '' }));
});
