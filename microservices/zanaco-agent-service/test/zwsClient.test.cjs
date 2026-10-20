const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { ZanacoClient, validateZanacoConfiguration } = require('../dist/zwsClient');
const { sendZanacoPayment, queryTransactionStatus } = require('../dist/zanacoAgent');
const { submitBulk, prepareBulkPayload, reconcileBulk } = require('../dist/bulk');

const pair = () => crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const idc = pair(), bankKeys = pair();
const config = { baseUrl: 'https://bank.test', apiKey: 'test-api', accessKey: 'test-access', apiSecret: 'test-secret',
  partnerPrivateKey: idc.privateKey, zanacoPublicKey: bankKeys.publicKey, requireResponseSignature: true };
const sign = value => crypto.sign('RSA-SHA256', Buffer.from(value), bankKeys.privateKey).toString('base64');
const signed = response => new Response(JSON.stringify({ response, signature: sign(JSON.stringify(response)) }), { status: 200 });
const token = () => signed({ accessToken: 'access-test', refreshToken: 'refresh-test' });
const prepared = { service: 'ZANACO_RTGS', endpoint: '/payment', method: 'POST', externalTranRef: 'REF1234567890123', request: { amount: '10' } };
const reply = (status, response) => ({ status, ok: status >= 200 && status < 300, data: { response } });

test('startup rejects missing credentials, invalid PEM keys and unsafe bank URLs', () => {
  const env = {
    ZANACO_BASE_URL: 'https://bank.test', ZANACO_API_KEY: 'test-api', ZANACO_ACCESS_KEY: 'test-access',
    ZANACO_API_SECRET: 'test-secret', ZANACO_PRIVATE_KEY: idc.privateKey, ZANACO_PUBLIC_KEY: bankKeys.publicKey,
    ZANACO_REQUIRE_RESPONSE_SIGNATURE: 'true', APP_API_URL: 'http://portal.test', BANK_PULL_API_KEY: 'portal-test',
  };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  try {
    Object.assign(process.env, env);
    assert.doesNotThrow(validateZanacoConfiguration);
    process.env.ZANACO_API_KEY = '';
    assert.throws(validateZanacoConfiguration, /apiKey/);
    process.env.ZANACO_API_KEY = env.ZANACO_API_KEY;
    process.env.ZANACO_BASE_URL = 'http://bank.test';
    assert.throws(validateZanacoConfiguration, /HTTPS/);
    process.env.ZANACO_BASE_URL = env.ZANACO_BASE_URL;
    process.env.ZANACO_PRIVATE_KEY = '/path/to/key.pem';
    assert.throws(validateZanacoConfiguration);
    process.env.ZANACO_PRIVATE_KEY = env.ZANACO_PRIVATE_KEY;
    process.env.BANK_PULL_API_KEY = '';
    assert.throws(validateZanacoConfiguration, /BANK_PULL_API_KEY/);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('login and payment bodies are signed using IDC private key; signed bank responses are verified', async () => {
  const calls = [];
  const client = new ZanacoClient(config, async (url, init) => {
    calls.push(url);
    assert.equal(crypto.verify('RSA-SHA256', Buffer.from(init.body), idc.publicKey, Buffer.from(init.headers.signature, 'base64')), true);
    assert.equal(init.body, JSON.stringify(JSON.parse(init.body)));
    if (url.endsWith('/token')) {
      assert.deepEqual(JSON.parse(init.body), { apiKey: 'test-api', grantType: 'login', accessKey: 'test-access', apiSecret: 'test-secret' });
      return token();
    }
    assert.equal(init.headers.Authorization, 'Bearer access-test');
    return signed({ respCode: 'ZWS-01', externalTranRef: prepared.externalTranRef, tranRefNo: 'BANK1' });
  });
  assert.equal((await client.send(prepared)).status, 200);
  assert.equal((await client.send(prepared)).status, 200);
  assert.equal(calls.filter(url => url.endsWith('/token')).length, 1);
});

test('concurrent token requests share one login', async () => {
  let calls = 0;
  const client = new ZanacoClient(config, async () => { calls++; return token(); });
  await Promise.all([client.getAccessToken(), client.getAccessToken(), client.getAccessToken()]);
  assert.equal(calls, 1);
});

test('near-expiry credentials use the documented refresh endpoint', async () => {
  const previous = process.env.ZANACO_ACCESS_TOKEN_TTL_MS;
  process.env.ZANACO_ACCESS_TOKEN_TTL_MS = '1000';
  try {
    const calls = [];
    const client = new ZanacoClient(config, async (url, init) => {
      calls.push(url);
      if (url.endsWith('/refresh')) {
        assert.equal(JSON.parse(init.body).grantType, 'refresh_token');
        assert.equal(JSON.parse(init.body).refreshToken, 'refresh-test');
      }
      return token();
    });
    await client.getAccessToken();
    await client.getAccessToken();
    assert.deepEqual(calls, ['https://bank.test/zws-auth-service/v1.0/token', 'https://bank.test/zws-auth-service/v1.0/token/refresh']);
  } finally {
    if (previous === undefined) delete process.env.ZANACO_ACCESS_TOKEN_TTL_MS;
    else process.env.ZANACO_ACCESS_TOKEN_TTL_MS = previous;
  }
});

test('tampered and missing response signatures are rejected', async () => {
  for (const response of [
    () => new Response(JSON.stringify({ response: { accessToken: 'tampered' }, signature: sign('{}') })),
    () => new Response(JSON.stringify({ response: { accessToken: 'unsigned' } })),
  ]) {
    const client = new ZanacoClient(config, async () => response());
    await assert.rejects(client.getAccessToken(), /signature/i);
  }
});

test('HTTP signature verifies the exact body and request redirects are disabled', async () => {
  const client = new ZanacoClient(config, async (_, init) => {
    assert.equal(init.redirect, 'error');
    const body = JSON.stringify({ response: { accessToken: 'access-test', refreshToken: 'refresh-test' } });
    return new Response(body, { headers: { signature: sign(body) } });
  });
  assert.equal(await client.getAccessToken(), 'access-test');
});

test('request timeout covers a stalled response body', async () => {
  const previous = process.env.ZANACO_REQUEST_TIMEOUT_MS;
  process.env.ZANACO_REQUEST_TIMEOUT_MS = '20';
  try {
    const client = new ZanacoClient(config, async (_, init) => ({
      text: () => new Promise((resolve, reject) => {
        if (init.signal.aborted) reject(new Error('aborted'));
        else init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      }),
    }));
    await assert.rejects(client.getAccessToken(), /abort/i);
  } finally {
    if (previous === undefined) delete process.env.ZANACO_REQUEST_TIMEOUT_MS;
    else process.env.ZANACO_REQUEST_TIMEOUT_MS = previous;
  }
});

test('unknown, malformed success and server errors never authorise transaction resubmission', async () => {
  for (const response of [
    reply(200, { respCode: 'ZWS-51' }), reply(503, {}),
    reply(200, { respCode: 'ZWS-01', externalTranRef: 'OTHER', tranRefNo: 'BANK1' }),
    reply(200, { respCode: 'ZWS-01', externalTranRef: prepared.externalTranRef }),
    reply(202, { respCode: 'ZWS-01' }),
  ]) {
    let calls = 0;
    const result = await sendZanacoPayment(prepared, { send: async () => { calls++; return response; } });
    assert.equal(calls, 1);
    assert.equal(result.success, false);
    assert.equal(result.unknown, true);
    assert.notEqual(result.retryable, true);
  }
});

test('status confirms matching identity and bank posting reference only', async () => {
  const result = await queryTransactionStatus(prepared.externalTranRef, { send: async request => {
    assert.equal(request.endpoint, '/zws-fcubs-service/api/v1/flex/transferStatus');
    assert.deepEqual(request.request, { externalTranRef: prepared.externalTranRef });
    return reply(200, { respCode: 'ZWS-01', externalTranRef: prepared.externalTranRef, tranRefNo: 'BANK1' });
  } });
  assert.equal(result.success, true);
  for (const response of [reply(404, { respCode: 'ZWS-55' }), reply(200, { respCode: 'ZWS-51' }), reply(200, { respCode: 'ZWS-01', externalTranRef: 'OTHER', tranRefNo: 'BANK1' })]) {
    assert.equal((await queryTransactionStatus(prepared.externalTranRef, { send: async () => response })).unknown, true);
  }
});

test('reference used by another caller is not confirmed success or permission to resend', async () => {
  const bank = { send: async () => reply(409, { respCode: 'ZWS-56' }) };
  for (const result of [await sendZanacoPayment(prepared, bank), await queryTransactionStatus(prepared.externalTranRef, bank)]) {
    assert.equal(result.success, false);
    assert.notEqual(result.retryable, true);
    assert.match(result.error, /another caller/);
  }
});

test('bulk approval is acceptance, never settlement, and recovery preserves its reference', async () => {
  const request = prepareBulkPayload('ZANACO_BULK_INTERNAL', {
    batchName: 'Payroll', currency: 'ZMW', totalCount: 1, totalAmount: 10,
    items: [{ debitAccount: '1234567890123', creditAccount: '9876543210123', externalTranRef: 'BULKREF1', amount: 10, name: 'Alice' }],
  });
  const result = await submitBulk(request, { send: async () => reply(202, { respCode: 'ZWS-01', status: 'PENDING_APPROVAL', batchReference: 'BATCH1' }) });
  assert.equal(result.success, false);
  assert.equal(result.accepted, true);
  const recovered = await reconcileBulk(result);
  assert.equal(recovered.accepted, true);
  assert.deepEqual(recovered.data, result.data);
});
