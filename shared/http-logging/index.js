'use strict';

const http = require('node:http');
const https = require('node:https');
const { AsyncLocalStorage } = require('node:async_hooks');
const { randomUUID } = require('node:crypto');
const installed = Symbol.for('idc.httpLogging');
const observed = Symbol('httpLoggingObserved');
const sensitive = /password|passwd|secret|token|authorization|cookie|signature|privatekey|apikey|accesskey|agentkey|bankpull(?:api)?key|clientid|credential|session|csrf/i;
const normalize = value => String(value).replace(/[^a-z0-9]/gi, '');

function redact(value, key = '') {
  if (sensitive.test(normalize(key))) return '[REDACTED]';
  if (Array.isArray(value)) return value.map(item => redact(item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, redact(item, name)]));
  if (typeof value !== 'string') return value;
  let result = value.replace(/-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----[\s\S]*?(?:-----END (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----|$)/g, '[REDACTED PRIVATE KEY]')
    .replace(/\bBearer\s+[^\s"<>]+/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED TOKEN]')
    .replace(/<([\w:.-]*(?:password|secret|token|signature|private[_-]?key|api[_-]?key|access[_-]?key))[\s>][\s\S]*?<\/\1>/gi, '<$1>[REDACTED]</$1>')
    .replace(/(["']?(?:password|client_secret|client_id|access_token|refresh_token|api[_-]?key|private[_-]?key|signature)["']?\s*[:=]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s&<,}]+)/gi, '$1[REDACTED]');
  // Remove configured credentials even when a bank echoes them in free text.
  for (const [name, secret] of Object.entries(process.env)) {
    if (sensitive.test(normalize(name)) && secret && secret.length >= 6 && !name.startsWith('HTTP_LOG_')) result = result.split(secret).join('[REDACTED]');
  }
  return result;
}

function safeUrl(value) {
  try {
    const url = new URL(value, 'http://local');
    url.username = ''; url.password = ''; url.hash = '';
    for (const key of url.searchParams.keys()) if (sensitive.test(normalize(key))) url.searchParams.set(key, '[REDACTED]');
    return redact(value.startsWith('/') ? url.pathname + url.search : url.toString());
  } catch { return '[invalid URL]'; }
}

function bodyText(buffer, headers, url, truncated) {
  const contentType = String(headers['content-type'] || '');
  if (/\/(?:auth|login|logout|token|credentials|reset-password)(?:\/|\?|$)/i.test(url)) return '[authentication body omitted]';
  if (headers['content-encoding'] && headers['content-encoding'] !== 'identity') return `[encoded body omitted: ${headers['content-encoding']}]`;
  if (contentType && !/json|text|xml|javascript|x-www-form-urlencoded/i.test(contentType)) return `[non-text body omitted: ${contentType}]`;
  if (buffer.length === 0) return '[empty body]';
  const text = buffer.toString('utf8');
  let result;
  if (truncated) {
    // A partial JSON/XML/form body cannot be reliably redacted.
    return '[body preview omitted: incomplete capture or HTTP_LOG_MAX_BODY_BYTES exceeded]';
  }
  try { result = JSON.stringify(redact(JSON.parse(text)), null, 2); }
  catch {
    if (/x-www-form-urlencoded/i.test(contentType)) result = JSON.stringify(redact(Object.fromEntries(new URLSearchParams(text))), null, 2);
    else result = redact(text);
  }
  return result;
}

function capture(limit) {
  const chunks = [];
  let size = 0, truncated = false;
  return {
    add(chunk, encoding) {
      if (typeof chunk !== 'string' && !Buffer.isBuffer(chunk) && !(chunk instanceof Uint8Array)) return;
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === 'string' ? encoding : undefined);
      if (size + data.length > limit) truncated = true;
      if (size < limit) chunks.push(data.subarray(0, limit - size));
      size += data.length;
    },
    get buffer() { return Buffer.concat(chunks); },
    get truncated() { return truncated; },
  };
}

// Observe emitted chunks instead of reading or adding a data listener. The app
// remains the sole consumer and keeps its original streaming/backpressure behavior.
function tapReadable(stream, collected, onEnd, run = callback => callback()) {
  const original = stream.emit;
  let done = false;
  stream.emit = function (event, ...args) {
    if (event === 'data') collected.add(args[0]);
    if (!done && ['end', 'aborted', 'error', 'close'].includes(event)) {
      done = true;
      stream.emit = original;
      onEnd(event === 'end' ? 'complete' : event);
    }
    return run(() => Reflect.apply(original, this, [event, ...args]));
  };
}

function tapWritable(stream, collected) {
  for (const method of ['write', 'end']) {
    const original = stream[method];
    stream[method] = function (chunk, encoding, ...args) {
      collected.add(chunk, encoding);
      return Reflect.apply(original, this, [chunk, encoding, ...args]);
    };
  }
}

function installHttpLogging(service, options = {}) {
  if (globalThis[installed]) return globalThis[installed];
  if (process.env.HTTP_LOG_ENABLED === 'false') return { enabled: false };
  const limit = Math.min(10 * 1024 * 1024, Math.max(1024, Number(process.env.HTTP_LOG_MAX_BODY_BYTES) || 256 * 1024));
  const bodyTimeout = Math.max(100, Number(process.env.HTTP_LOG_BODY_TIMEOUT_MS) || 10000);
  const context = new AsyncLocalStorage();
  const sink = options.sink || (line => console.info(line));
  const restore = [];
  const validId = value => typeof value === 'string' && /^[a-z0-9._:-]{1,128}$/i.test(value);
  function log(direction, stage, id, metadata, headers = {}, body, state) {
    try {
      const safeHeaders = redact(headers);
      const text = body && process.env.HTTP_LOG_BODIES !== 'false' ? bodyText(body.buffer, headers, metadata.url || '', body.truncated || Boolean(state && state !== 'complete')) : '[body logging disabled or unavailable]';
      sink([`[HTTP ${service} ${id}] ${direction} ${stage} ${new Date().toISOString()}`,
        JSON.stringify(redact(metadata)), ...Object.entries(safeHeaders).map(([key, value]) => `${key}: ${value}`), '',
        text, ...(state ? [`body_state: ${state}`] : []), `[HTTP ${service} ${id}] END ${stage}`].join('\n'));
    } catch { /* Diagnostics must never interrupt HTTP processing or trigger a retry. */ }
  }
  function observeWebBody(stream, direction, stage, id, metadata, headers) {
    void (async () => {
      const body = capture(limit);
      const reader = stream?.getReader();
      let state = 'complete';
      let timer;
      try {
        if (reader) {
          const timeout = new Promise(resolve => { timer = setTimeout(() => resolve({ timeout: true }), bodyTimeout); timer.unref?.(); });
          while (true) {
            const item = await Promise.race([reader.read(), timeout]);
            if (item.timeout) { state = 'body_capture_timeout'; body.add(Buffer.alloc(limit + 1)); break; }
            if (item.done) break;
            body.add(item.value);
            if (body.truncated) { state = 'size_limit'; break; }
          }
        }
      } catch { state = 'body_read_error'; body.add(Buffer.alloc(limit + 1)); }
      finally {
        clearTimeout(timer);
        if (state !== 'complete') void reader?.cancel().catch(() => {});
        log(direction, stage, id, metadata, headers, body, state);
      }
    })().catch(() => {});
  }
  function incoming(req, res) {
    const supplied = req.headers['x-correlation-id'];
    const id = validId(supplied) ? supplied : randomUUID();
    const started = Date.now();
    const metadata = { method: req.method, url: safeUrl(req.url || '/'), remoteAddress: req.socket?.remoteAddress };
    const requestBody = capture(limit), responseBody = capture(limit);
    res.setHeader('x-correlation-id', id);
    log('INBOUND', 'REQUEST', id, metadata, req.headers);
    tapReadable(req, requestBody, state => log('INBOUND', 'REQUEST BODY', id, metadata, req.headers, requestBody, state), callback => context.run({ id }, callback));
    tapWritable(res, responseBody);
    let done = false;
    const finished = state => {
      if (done) return;
      done = true;
      log('INBOUND', 'RESPONSE', id, { ...metadata, status: res.statusCode, durationMs: Date.now() - started }, res.getHeaders(), responseBody, state);
    };
    res.once('finish', () => finished('complete'));
    res.once('close', () => finished(res.writableFinished ? 'complete' : 'connection_closed'));
    return id;
  }
  for (const Server of [http.Server, https.Server]) {
    const proto = Server.prototype;
    const own = Object.prototype.hasOwnProperty.call(proto, 'emit');
    const original = proto.emit;
    proto.emit = function (event, ...args) {
      if (event === 'request' && args[0] && args[1] && !args[0][observed]) {
        args[0][observed] = true;
        let id;
        try { id = incoming(args[0], args[1]); } catch { /* preserve the request */ }
        return context.run({ id }, () => Reflect.apply(original, this, [event, ...args]));
      }
      return Reflect.apply(original, this, [event, ...args]);
    };
    restore.push(() => { if (own) proto.emit = original; else delete proto.emit; });
  }
  for (const transport of [http, https]) {
    const original = transport.request;
    transport.request = function (...args) {
      const request = Reflect.apply(original, this, args);
      const supplied = request.getHeader('x-correlation-id');
      const id = context.getStore()?.id || (validId(supplied) ? supplied : randomUUID());
      if (!request.hasHeader('x-correlation-id') && !request.headersSent) request.setHeader('x-correlation-id', id);
      const started = Date.now();
      const metadata = { method: request.method, url: safeUrl(`${request.protocol}//${request.getHeader('host')}${request.path}`) };
      const requestBody = capture(limit);
      tapWritable(request, requestBody);
      request.once('finish', () => log('OUTBOUND', 'REQUEST', id, metadata, request.getHeaders(), requestBody, 'complete'));
      let gotResponse = false;
      const emit = request.emit;
      request.emit = function (event, ...values) {
        if (event === 'response') {
          gotResponse = true;
          const response = values[0], responseBody = capture(limit);
          log('OUTBOUND', 'RESPONSE HEADERS', id, { ...metadata, status: response.statusCode, durationMs: Date.now() - started }, response.headers);
          tapReadable(response, responseBody, state => log('OUTBOUND', 'RESPONSE', id,
            { ...metadata, status: response.statusCode, durationMs: Date.now() - started }, response.headers, responseBody, state));
        }
        if (event === 'error') log('OUTBOUND', 'ERROR', id, { ...metadata, durationMs: Date.now() - started, errorCode: values[0]?.code || values[0]?.name || 'UNKNOWN' }, {}, requestBody, 'incomplete');
        if (event === 'close' && !gotResponse && !request.destroyed) log('OUTBOUND', 'CLOSED', id, metadata);
        return context.run({ id }, () => Reflect.apply(emit, this, [event, ...values]));
      };
      return request;
    };
    // get() holds an internal reference to request(), so wrap it as well.
    const originalGet = transport.get;
    transport.get = function (...args) { const request = transport.request(...args); request.end(); return request; };
    restore.push(() => { transport.request = original; transport.get = originalGet; });
  }
  const originalFetch = globalThis.fetch;
  if (originalFetch) {
    globalThis.fetch = async function (input, init) {
      const started = Date.now();
      const metadata = { method: init?.method || input?.method || 'GET', url: safeUrl(String(input?.url || input)) };
      const headers = Object.fromEntries(new Headers(init?.headers || input?.headers));
      const id = context.getStore()?.id || (validId(headers['x-correlation-id']) ? headers['x-correlation-id'] : randomUUID());
      if (!headers['x-correlation-id']) headers['x-correlation-id'] = id;
      const requestBody = capture(limit);
      if (init?.body != null) {
        if (init.body instanceof URLSearchParams) requestBody.add(init.body.toString());
        else if (typeof init.body === 'string' || Buffer.isBuffer(init.body) || init.body instanceof Uint8Array) requestBody.add(init.body);
        else requestBody.add('[streamed or multipart request body not buffered]');
      } else if (input instanceof Request && input.body && process.env.HTTP_LOG_BODIES !== 'false') {
        try { observeWebBody(input.clone().body, 'OUTBOUND', 'REQUEST BODY', id, metadata, headers); }
        catch { requestBody.add('[request body unavailable]'); }
      }
      log('OUTBOUND', 'REQUEST', id, metadata, headers, requestBody);
      try {
        const response = await Reflect.apply(originalFetch, this, [input, { ...init, headers }]);
        const responseHeaders = Object.fromEntries(response.headers);
        // Fetch has already decoded content-encoding; do not label it compressed.
        const decodedHeaders = { ...responseHeaders }; delete decodedHeaders['content-encoding'];
        const details = { ...metadata, status: response.status, durationMs: Date.now() - started };
        log('OUTBOUND', 'RESPONSE HEADERS', id, details, responseHeaders);
        if (process.env.HTTP_LOG_BODIES !== 'false') {
          try { observeWebBody(response.clone().body, 'OUTBOUND', 'RESPONSE', id, details, decodedHeaders); }
          catch { log('OUTBOUND', 'RESPONSE', id, details, decodedHeaders, undefined, 'body_unavailable'); }
        }
        return response;
      } catch (error) {
        log('OUTBOUND', 'ERROR', id, { ...metadata, durationMs: Date.now() - started, errorCode: error?.cause?.code || error?.code || error?.name || 'UNKNOWN' });
        throw error;
      }
    };
    restore.push(() => { globalThis.fetch = originalFetch; });
  }
  const result = { enabled: true, uninstall() { for (const reset of restore.reverse()) reset(); delete globalThis[installed]; } };
  globalThis[installed] = result;
  return result;
}

module.exports = { installHttpLogging, redact, safeUrl };
