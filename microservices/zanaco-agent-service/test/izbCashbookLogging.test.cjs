const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { load } = require('./helpers/portal.cjs');

test('IZB logs rejected JSON and portal cashbook responses without payment data or keys', async () => {
  const middleware = [], routes = new Map(), logs = [];
  const app = { use: fn => middleware.push(fn), post: (path, fn) => routes.set(path, fn), get() {}, listen() {} };
  const express = Object.assign(() => app, { json: () => (_req, _res, next) => next() });
  const originalLog = console.log, originalWarn = console.warn, originalFetch = global.fetch;
  const previous = { ...process.env };
  function response() {
    return Object.assign(new EventEmitter(), {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; this.emit('finish'); return this; },
      send(body) { this.body = body; this.emit('finish'); return this; },
    });
  }
  try {
    console.log = console.warn = (...args) => logs.push(args.join(' '));
    process.env.APP_API_URL = 'http://portal';
    process.env.AGENT_API_KEY = 'private-agent-key';
    process.env.BANK_PULL_API_KEY = 'private-portal-key';
    load('microservices/izb-agent-service/src/index.ts', {
      express, cors: () => (_req, _res, next) => next(), dotenv: { config() {} }, './db': { initDatabase() {} },
    });
    const req = { method: 'POST', path: '/api/v1/postCBTxn', headers: { 'x-api-key': 'private-agent-key' }, body: { transactionId: 'IDC0A46191C9', accountNumber: 'sensitive-account', secret: 'private-payment-value' } };
    const handler = routes.get(req.path);
    let forwarded;
    global.fetch = async (_url, options) => {
      forwarded = options;
      return { status: 400, ok: false, text: async () => JSON.stringify({ responseMessage: 'Invalid receipt request payload' }) };
    };
    const res = response();
    middleware[1](req, res, () => {});
    await handler(req, res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(JSON.parse(forwarded.body), req.body);
    assert.equal(forwarded.headers['x-bank-api-key'], 'private-portal-key');
    const events = logs.map(line => JSON.parse(line));
    assert.ok(events.some(event => event.event === 'cashbook.portal.response' && event.status === 400 && event.transactionId === req.body.transactionId));
    assert.ok(events.some(event => event.event === 'http.response' && event.status === 400));
    const malformed = response();
    middleware[1](req, malformed, () => {});
    middleware[3]({ type: 'entity.parse.failed', body: 'private-malformed-body' }, req, malformed, () => assert.fail('handled parse error'));
    assert.equal(malformed.statusCode, 400);
    assert.deepEqual(malformed.body, { error: 'Invalid JSON payload' });
    const unauthorized = response();
    await handler({ ...req, headers: {} }, unauthorized);
    assert.equal(unauthorized.statusCode, 401);
    global.fetch = async () => { throw new Error('private-fetch-error'); };
    assert.equal((await handler(req, response())).statusCode, 500);
    const output = logs.join('\n');
    for (const secret of ['private-agent-key', 'private-portal-key', 'sensitive-account', 'private-payment-value', 'private-malformed-body', 'private-fetch-error']) assert.equal(output.includes(secret), false);
  } finally {
    console.log = originalLog; console.warn = originalWarn; global.fetch = originalFetch;
    for (const key of ['APP_API_URL', 'AGENT_API_KEY', 'BANK_PULL_API_KEY']) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
});
