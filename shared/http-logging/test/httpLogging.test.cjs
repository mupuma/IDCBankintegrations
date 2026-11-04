const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { installHttpLogging, redact, safeUrl } = require('..');

test('redacts credentials recursively, in URLs, PEM text, XML and free-text echoes', () => {
  const body = { client_secret: 'secret1', nested: { accessToken: 'token1', password: 'pass1' }, account_number: '00123', message: 'Bearer abc123' };
  const clean = redact(body);
  assert.equal(clean.nested.accessToken, '[REDACTED]');
  assert.equal(clean.nested.password, '[REDACTED]');
  assert.equal(clean.account_number, '00123');
  assert.equal(JSON.stringify(clean).includes('secret1'), false);
  assert.equal(redact('-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----'), '[REDACTED PRIVATE KEY]');
  assert.equal(redact('<Password>mypassword</Password>'), '<Password>[REDACTED]</Password>');
  assert.equal(safeUrl('https://user:pass@bank.test/pay?api_key=secret&reference=REF').includes('secret'), false);
  assert.equal(safeUrl('https://user:pass@bank.test/pay').includes('user:pass'), false);
});

test('logs real inbound webhook and outgoing native/fetch bodies without changing HTTP behavior', async t => {
  const logs = [];
  const logging = installHttpLogging('test-service', { sink: line => logs.push(line) });
  t.after(() => logging.uninstall());
  assert.equal(installHttpLogging('same-process'), logging);
  const bank = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (req.url.startsWith('/html')) { res.writeHead(500, { 'Content-Type': 'text/html' }); res.end('<html>bank failed</html>'); return; }
    if (req.url.startsWith('/large')) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ password: 'LEAK'.repeat(100000) })); return; }
    if (req.url.startsWith('/stream')) { res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.write('data: first\n\n'); return; }
    res.writeHead(422, { 'Content-Type': 'application/json', 'set-cookie': 'cookie-secret', 'x-bank-id': 'BANK-123' });
    res.write('{"error":"validation_error",');
    res.end('"message":"receiver_bic is invalid","access_token":"response-secret"}');
    assert.ok(Buffer.concat(chunks).toString().includes('IDC-2026-00001'));
  });
  bank.listen(0, '127.0.0.1'); await once(bank, 'listening');
  t.after(() => { bank.closeAllConnections(); bank.close(); });
  const bankUrl = `http://127.0.0.1:${bank.address().port}`;
  const portal = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const payload = Buffer.concat(chunks).toString();
    const bankResponse = await fetch(bankUrl + '/pay', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer request-secret' }, body: payload });
    const body = await bankResponse.text();
    res.writeHead(bankResponse.status, { 'Content-Type': 'application/json' }); res.end(body);
  });
  portal.listen(0, '127.0.0.1'); await once(portal, 'listening');
  t.after(() => { portal.closeAllConnections(); portal.close(); });
  const payload = JSON.stringify({ prcn_number: 'IDC-2026-00001', account_number: '0012345', client_secret: 'body-secret' });
  const result = await new Promise((resolve, reject) => {
    const req = http.request(`http://127.0.0.1:${portal.address().port}/webhooks/bank`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-correlation-id': 'TRACE-123', 'x-api-key': 'header-secret' },
    }, async res => {
      try { const chunks = []; for await (const chunk of res) chunks.push(chunk); resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }); }
      catch (error) { reject(error); }
    });
    req.on('error', reject); req.write(payload.slice(0, 20)); req.end(payload.slice(20));
  });
  assert.equal(result.status, 422);
  assert.equal(result.headers['x-correlation-id'], 'TRACE-123');
  assert.equal(JSON.parse(result.body).access_token, 'response-secret'); // Redaction must not affect the real response.
  await new Promise(resolve => setTimeout(resolve, 50));
  const text = logs.join('\n');
  for (const secret of ['body-secret', 'request-secret', 'header-secret', 'cookie-secret', 'response-secret']) assert.equal(text.includes(secret), false, secret);
  for (const expected of ['INBOUND REQUEST BODY', 'INBOUND RESPONSE', 'OUTBOUND REQUEST', 'OUTBOUND RESPONSE', 'receiver_bic is invalid', 'IDC-2026-00001', 'BANK-123', 'TRACE-123', '0012345']) assert.ok(text.includes(expected), expected);
  assert.ok(!text.includes('body_capture_timeout'));
  // Native write/end capture must contain one unmodified JSON body, without duplication.
  const outbound = logs.find(line => line.includes('OUTBOUND REQUEST') && line.includes('/webhooks/bank'));
  assert.equal((outbound.match(/"prcn_number"/g) || []).length, 1);
  const html = await fetch(bankUrl + '/html'); assert.equal(await html.text(), '<html>bank failed</html>');
  const large = await fetch(bankUrl + '/large'); assert.ok((await large.text()).length > 256 * 1024);
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.ok(logs.some(line => line.includes('<html>bank failed</html>')));
  assert.ok(logs.some(line => line.includes('HTTP_LOG_MAX_BODY_BYTES exceeded')));
  assert.equal(logs.join('\n').includes('LEAK'), false);
  // Transport failures still reject; no retry or payment replay is introduced.
  await assert.rejects(fetch('http://127.0.0.1:1/failure'));
  assert.ok(logs.some(line => line.includes('OUTBOUND ERROR')));
});

test('slow response logging is bounded and never consumes the application stream', async t => {
  const previous = process.env.HTTP_LOG_BODY_TIMEOUT_MS;
  process.env.HTTP_LOG_BODY_TIMEOUT_MS = '100';
  const logs = [];
  const logging = installHttpLogging('stream-test', { sink: line => logs.push(line) });
  const server = http.createServer((_req, res) => { res.writeHead(200, { 'content-type': 'text/event-stream' }); res.write('data: hello\n\n'); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { logging.uninstall(); server.closeAllConnections(); server.close(); if (previous === undefined) delete process.env.HTTP_LOG_BODY_TIMEOUT_MS; else process.env.HTTP_LOG_BODY_TIMEOUT_MS = previous; });
  const controller = new AbortController();
  const response = await fetch(`http://127.0.0.1:${server.address().port}`, { signal: controller.signal });
  const reader = response.body.getReader();
  assert.equal(Buffer.from((await reader.read()).value).toString(), 'data: hello\n\n');
  await new Promise(resolve => setTimeout(resolve, 160));
  assert.ok(logs.some(line => line.includes('body_capture_timeout')));
  controller.abort();
});

test('Request bodies remain readable and authentication exchanges omit their payloads', async t => {
  const logs = [];
  const logging = installHttpLogging('request-test', { sink: line => logs.push(line) });
  t.after(() => logging.uninstall());
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(Buffer.concat(chunks).toString());
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const root = `http://127.0.0.1:${server.address().port}`;
  const request = new Request(root + '/webhook', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"paymentId":"PAYMENT-1"}' });
  const response = await fetch(request);
  assert.equal(await response.text(), '{"paymentId":"PAYMENT-1"}');
  const token = await fetch(root + '/auth/token', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'sensitive-unstructured-value' });
  assert.equal(await token.text(), 'sensitive-unstructured-value');
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.ok(logs.some(line => line.includes('OUTBOUND REQUEST BODY') && line.includes('PAYMENT-1')));
  assert.equal(logs.join('\n').includes('sensitive-unstructured-value'), false);
  assert.ok(logs.some(line => line.includes('[authentication body omitted]')));
});

test('metadata-only and disabled modes do not leak payloads or replace transports when disabled', async t => {
  const previous = { enabled: process.env.HTTP_LOG_ENABLED, bodies: process.env.HTTP_LOG_BODIES };
  t.after(() => {
    for (const [key, value] of [['HTTP_LOG_ENABLED', previous.enabled], ['HTTP_LOG_BODIES', previous.bodies]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const before = globalThis.fetch;
  process.env.HTTP_LOG_ENABLED = 'false';
  assert.equal(installHttpLogging('disabled').enabled, false);
  assert.equal(globalThis.fetch, before);
  delete process.env.HTTP_LOG_ENABLED;
  process.env.HTTP_LOG_BODIES = 'false';
  const logs = [];
  const logging = installHttpLogging('metadata-test', { sink: line => logs.push(line) });
  t.after(() => logging.uninstall());
  const server = http.createServer(async (req, res) => {
    for await (const chunk of req) { /* consume as the application normally would */ }
    res.writeHead(200, { 'content-type': 'text/plain' }); res.end('private-body-data');
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const result = await fetch(`http://127.0.0.1:${server.address().port}`, { method: 'POST', body: 'private-request-data' });
  assert.equal(await result.text(), 'private-body-data');
  const text = logs.join('\n');
  assert.ok(text.includes('INBOUND RESPONSE'));
  assert.equal(text.includes('private-body-data'), false);
  assert.equal(text.includes('private-request-data'), false);
});

test('parallel webhook callbacks retain their own correlation IDs after body-parser style callbacks', async t => {
  const logs = [];
  const logging = installHttpLogging('correlation-test', { sink: line => logs.push(line) });
  t.after(() => logging.uninstall());
  const upstream = http.createServer((req, res) => res.end(req.headers['x-correlation-id']));
  upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
  t.after(() => { upstream.closeAllConnections(); upstream.close(); });
  const server = http.createServer((req, res) => {
    req.on('data', () => {});
    req.on('end', () => {
      setTimeout(async () => {
        const reply = await fetch(`http://127.0.0.1:${upstream.address().port}/status`);
        res.end(await reply.text());
      }, req.url === '/first' ? 15 : 1);
    });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const first = await Promise.all(['first', 'second'].map(async name => {
    const result = await fetch(`http://127.0.0.1:${server.address().port}/${name}`, {
      method: 'POST', headers: { 'x-correlation-id': `TRACE-${name}` }, body: name,
    });
    return result.text();
  }));
  assert.deepEqual(first, ['TRACE-first', 'TRACE-second']);
  assert.ok(logs.some(line => line.includes('correlation-test TRACE-first] OUTBOUND REQUEST') && line.includes('/status')));
  assert.ok(logs.some(line => line.includes('correlation-test TRACE-second] OUTBOUND REQUEST') && line.includes('/status')));
});
