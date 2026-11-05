"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.H2hClient = void 0;
const zicb_h2h_1 = require("../../../shared/zicb-h2h");
const node_https_1 = require("node:https");
const node_crypto_1 = require("node:crypto");
class H2hAuthenticationError extends Error {
}
function authenticationConnectionError(error) {
    // Never return raw fetch messages, URLs, response bodies or credentials.
    const hints = {
        ENOTFOUND: 'check the authentication hostname and DNS', EAI_AGAIN: 'check DNS availability',
        ECONNREFUSED: 'check the authentication host, port and firewall',
        EHOSTUNREACH: 'check routing and VPN access to ZICB', ENETUNREACH: 'check routing and VPN access to ZICB',
        ETIMEDOUT: 'check network access and the authentication service',
        UND_ERR_CONNECT_TIMEOUT: 'check network access and the authentication service',
        UND_ERR_HEADERS_TIMEOUT: 'the authentication service did not respond in time',
        UND_ERR_BODY_TIMEOUT: 'the authentication response did not complete in time',
        ECONNRESET: 'the authentication connection was reset',
        CERT_HAS_EXPIRED: 'the authentication TLS certificate has expired',
        CERT_NOT_YET_VALID: 'check the server clock and authentication TLS certificate',
        DEPTH_ZERO_SELF_SIGNED_CERT: 'configure the trusted ZICB certificate authority',
        SELF_SIGNED_CERT_IN_CHAIN: 'configure the trusted ZICB certificate authority',
        UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'configure the ZICB TLS certificate chain',
        UNABLE_TO_GET_ISSUER_CERT_LOCALLY: 'configure the trusted ZICB certificate authority',
        ERR_TLS_CERT_ALTNAME_INVALID: 'use the hostname covered by the ZICB TLS certificate',
    };
    const pending = [error];
    const seen = new Set();
    while (pending.length && seen.size < 20) {
        const value = pending.shift();
        if (!value || typeof value !== 'object' || seen.has(value))
            continue;
        seen.add(value);
        const item = value;
        if (item.code && Object.prototype.hasOwnProperty.call(hints, item.code))
            return `Token request failed (${item.code}); ${hints[item.code]}`;
        if (item.name === 'AbortError' || item.name === 'TimeoutError')
            return 'Token request timed out; check network access and the authentication service';
        pending.push(item.cause);
        if (Array.isArray(item.errors))
            pending.push(...item.errors);
    }
    return 'Token request failed; check authentication URL, network access and TLS certificates';
}
class H2hClient {
    constructor(profiles, transport = fetch, now = () => Date.now(), timeoutMs = 90000) {
        this.profiles = profiles;
        this.transport = transport;
        this.now = now;
        this.timeoutMs = timeoutMs;
        this.tokens = new Map();
        this.refreshing = new Map();
    }
    profile(id) {
        const profile = this.profiles[id];
        if (!profile)
            throw new H2hAuthenticationError('No agent credentials profile matches the requested profileId; the portal source profileId must exactly match a key in agent ZICB_H2H_PROFILES');
        if (!profile.clientId || !profile.clientSecret)
            throw new H2hAuthenticationError('The selected agent profile is missing clientId or clientSecret in ZICB_H2H_PROFILES');
        return profile;
    }
    url(base, path) {
        let url;
        try {
            url = new URL(base);
        }
        catch {
            throw new H2hAuthenticationError('H2H base URL is missing or invalid; check the selected agent profile URLs');
        }
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
            throw new H2hAuthenticationError('H2H base URLs must use HTTPS without embedded credentials, query strings or fragments');
        return `${base.replace(/\/$/, '')}${path}`;
    }
    log(event, fields) {
        // Allowlist response fields; never serialize request headers or full bank bodies.
        const redact = (value) => {
            if (typeof value !== 'string')
                return typeof value === 'number' ? value : undefined;
            for (const profile of Object.values(this.profiles)) {
                for (const secret of [profile.clientId, profile.clientSecret]) {
                    if (secret)
                        value = value.split(secret).join('[REDACTED]');
                }
            }
            for (const cached of this.tokens.values())
                value = value.split(cached.token).join('[REDACTED]');
            return value.replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
                .replace(/[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g, '[REDACTED]')
                .replace(/\d{7,}/g, '[REDACTED]').slice(0, 500);
        };
        const safe = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, redact(value)]));
        console.info(JSON.stringify({ timestamp: new Date().toISOString(), service: 'zicb-h2h-agent', event, ...safe }));
    }
    async http(url, init, context = {}) {
        const controller = new AbortController();
        const started = Date.now();
        const metadata = { ...context, method: init.method, endpoint: new URL(url).pathname };
        const systemHttpLogging = Boolean(globalThis[Symbol.for('idc.httpLogging')]?.enabled) || process.env.HTTP_LOG_ENABLED === 'false';
        const httpDiagnostics = !systemHttpLogging && process.env.ZICB_H2H_LOG_HTTP !== 'false' && !metadata.endpoint.includes('/auth/');
        const exchangeId = (0, node_crypto_1.randomUUID)();
        const headerLines = (headers) => Array.from(headers.entries()).map(([name, value]) => `${name}: ${/^(authorization|proxy-authorization|cookie|set-cookie)$/i.test(name) ? '[REDACTED]' : value}`);
        const label = `[ZICB HTTP ${exchangeId}] profile=${context.profileId || '-'} reference=${context.reference || '-'}`;
        if (httpDiagnostics) {
            console.info([
                `${label} REQUEST`, `${init.method || 'GET'} ${url}`,
                ...headerLines(new Headers(init.headers)), '',
                typeof init.body === 'string' ? init.body : '[no request body]',
                `${label} END REQUEST`,
            ].join('\n'));
        }
        const received = (result, rawBody, requestId, responseHeaders = [], statusLine = `HTTP ${result.status}`) => {
            this.log('bank_response', { ...metadata, httpStatus: result.status, durationMs: Date.now() - started,
                requestId, bankError: result.body?.error, bankStatus: result.body?.status,
                bankMessage: result.body?.message ?? result.body?.error_description,
                responseFormat: result.body === null ? 'empty_or_non_json' : 'json' });
            if (httpDiagnostics) {
                console.info([
                    `${label} RESPONSE (${Date.now() - started} ms)`, statusLine,
                    ...responseHeaders, '', rawBody,
                    ...(rawBody.length === 0 ? ['[bank returned an empty response body]'] : []),
                    `${label} END RESPONSE`,
                ].join('\n'));
            }
            if (!systemHttpLogging && process.env.ZICB_H2H_LOG_RAW_RESPONSES === 'true' && !metadata.endpoint.includes('/auth/')) {
                // Explicit diagnostic mode: preserve the exact decoded bank response text.
                // Do not pass through summary redaction/truncation or log token endpoints.
                console.info(JSON.stringify({ timestamp: new Date().toISOString(), service: 'zicb-h2h-agent',
                    event: 'bank_response_raw', ...metadata, httpStatus: result.status, requestId, rawBody }));
            }
            return result;
        };
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            if (this.transport === fetch) {
                // Approved NAT endpoints: equivalent to curl -k for all ZICB bank calls.
                // Scoped to this bank client; other application connections keep TLS verification.
                return await new Promise((resolve, reject) => {
                    const request = (0, node_https_1.request)(url, {
                        method: init.method,
                        headers: init.headers,
                        rejectUnauthorized: false,
                        signal: controller.signal,
                    }, response => {
                        const chunks = [];
                        response.on('data', chunk => chunks.push(Buffer.from(chunk)));
                        response.on('error', reject);
                        response.on('end', () => {
                            let body = null;
                            const rawBody = Buffer.concat(chunks).toString('utf8');
                            try {
                                body = JSON.parse(rawBody);
                            }
                            catch { /* Match fetch response parsing. */ }
                            const headers = [];
                            for (let index = 0; index < (response.rawHeaders?.length ?? 0); index += 2) {
                                const name = response.rawHeaders[index];
                                headers.push(`${name}: ${/^(set-cookie|authorization|proxy-authorization|cookie)$/i.test(name) ? '[REDACTED]' : response.rawHeaders[index + 1]}`);
                            }
                            resolve(received({ status: response.statusCode ?? 0, body }, rawBody, String(response.headers?.['x-request-id'] ?? ''), headers, `HTTP/${response.httpVersion} ${response.statusCode} ${response.statusMessage || ''}`.trim()));
                        });
                    });
                    request.on('error', reject);
                    request.end(init.body);
                });
            }
            const response = await this.transport(url, { ...init, signal: controller.signal, redirect: 'error' });
            const text = await response.text(); // Timeout covers the response body too.
            let body;
            try {
                body = text ? JSON.parse(text) : null;
            }
            catch {
                body = null;
            }
            return received({ status: response.status, body }, text, response.headers.get('x-request-id'), headerLines(response.headers), `HTTP ${response.status} ${response.statusText}`.trim());
        }
        catch (error) {
            const failure = error;
            this.log('bank_request_failed', { ...metadata, durationMs: Date.now() - started,
                errorCode: failure?.cause?.code ?? failure?.code ?? failure?.name ?? 'UNKNOWN',
                failureType: controller.signal.aborted ? 'timeout' : 'connection_or_response_error' });
            if (httpDiagnostics)
                console.info(`${label} NO COMPLETE RESPONSE: ${controller.signal.aborted ? 'timeout' : failure?.cause?.code ?? failure?.code ?? failure?.name ?? 'UNKNOWN'} (${Date.now() - started} ms)`);
            throw error;
        }
        finally {
            clearTimeout(timer);
        }
    }
    async token(id) {
        const cached = this.tokens.get(id);
        if (cached && cached.expires > this.now())
            return cached.token;
        const inFlight = this.refreshing.get(id);
        if (inFlight)
            return inFlight;
        const promise = (async () => {
            const profile = this.profile(id);
            const authUrl = this.url(profile.authUrl, '/h2h/auth/grant-type/client-credentials');
            let result;
            try {
                result = await this.http(authUrl, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ client_id: profile.clientId, client_secret: profile.clientSecret, grant_type: 'client_credentials' }),
                }, { profileId: id });
            }
            catch (error) {
                throw new H2hAuthenticationError(authenticationConnectionError(error));
            }
            if (result.status !== 200) {
                const hint = result.status === 401 ? 'check ZICB clientId and clientSecret'
                    : result.status === 403 ? 'ask ZICB to check client permissions and source IP allowlisting'
                        : result.status === 404 ? 'check authUrl; use the base URL, without the token endpoint appended'
                            : result.status >= 500 ? 'ZICB authentication service is unavailable'
                                : 'check the authentication endpoint and client configuration with ZICB';
                throw new H2hAuthenticationError(`Token request rejected (HTTP ${result.status}); ${hint}`);
            }
            if (!result.body?.access_token || result.body.token_type !== 'Bearer' || !Number.isFinite(result.body.expires_in) || result.body.expires_in <= 0)
                throw new H2hAuthenticationError('Token endpoint returned HTTP 200 without a valid access_token, Bearer token_type and positive numeric expires_in; confirm the endpoint and response format with ZICB');
            const lifetime = result.body.expires_in * 1000;
            this.tokens.set(id, { token: result.body.access_token, expires: this.now() + lifetime - Math.min(60000, lifetime / 10) });
            return result.body.access_token;
        })();
        this.refreshing.set(id, promise);
        try {
            return await promise;
        }
        finally {
            this.refreshing.delete(id);
        }
    }
    async authenticated(id, url, method, body) {
        let token = await this.token(id);
        const payload = body;
        const send = () => this.http(url, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }, { profileId: id, reference: payload?.reference ?? payload?.ext_batch_ref_no ?? '' });
        let result = await send();
        if (result.status === 401 && result.body?.error === 'invalid_token') {
            // Only a definite authentication rejection can replay this request.
            // Do not refresh/replay permission errors or network timeouts.
            if (this.tokens.get(id)?.token === token)
                this.tokens.delete(id);
            token = await this.token(id);
            result = await send();
        }
        return result;
    }
    businessUrl(id, channel, operation) {
        const p = this.profile(id);
        const base = channel === 'INTERNAL' ? p.internalUrl : channel === 'RTGS' ? p.rtgsUrl : p.ddaccUrl;
        return this.url(base, `${zicb_h2h_1.PATHS[channel]}/${operation}`);
    }
    async submit(id, channel, batch, scale) {
        const errors = (0, zicb_h2h_1.validateBatch)(channel, batch, scale);
        if (errors.length)
            return { state: 'rejected', notSent: true, notSentReason: 'validation', error: errors.join('; ') };
        // Acquire credentials before the submission boundary; a token failure sends no money.
        try {
            await this.token(id);
        }
        catch (error) {
            const detail = error instanceof H2hAuthenticationError ? error.message : 'Unexpected token acquisition failure; check the agent profile and authentication service';
            return { state: 'rejected', notSent: true, notSentReason: 'authentication', error: `H2H authentication/configuration failed before submission: ${detail}` };
        }
        try {
            const result = await this.authenticated(id, this.businessUrl(id, channel, 'send-money'), 'POST', batch);
            return (0, zicb_h2h_1.submissionOutcome)(result.status, result.body);
        }
        catch {
            return { state: 'unknown', error: 'Submission outcome unknown; reconcile the original reference before any resend' };
        }
    }
    async reconcile(id, channel, batch) {
        try {
            const result = await this.authenticated(id, this.businessUrl(id, channel, 'transaction-status'), 'POST', { ext_batch_ref_no: batch.reference });
            if (result.status !== 200) {
                const hint = result.status === 401 ? 'check the agent credentials and token configuration'
                    : result.status === 403 ? 'ask ZICB to check status-query permissions and source IP allowlisting'
                        : result.status === 404 ? 'confirm the status endpoint and original batch reference with ZICB; not-found does not authorise resubmission'
                            : 'check the ZICB status service and agent HTTP logs';
                return { state: 'unknown', error: `Bank status unavailable (HTTP ${result.status}); ${hint}; original reference retained` };
            }
            return (0, zicb_h2h_1.statusOutcome)(result.body, batch, channel);
        }
        catch (error) {
            const detail = error instanceof H2hAuthenticationError ? error.message
                : authenticationConnectionError(error).replace(/Token request/g, 'Status request').replace(/authentication/g, 'bank status');
            return { state: 'unknown', error: `Bank status check failed: ${detail}; original reference retained` };
        }
    }
    async verifyToken(id) {
        return this.authenticated(id, this.url(this.profile(id).authUrl, '/h2h/auth/grant-type/client-credentials/verify-token'), 'GET');
    }
    async lookup(id, channel, operation, body) {
        if ((channel === 'INTERNAL') !== (operation === 'name-lookup'))
            throw new Error('Lookup is not supported by this channel');
        return this.authenticated(id, this.businessUrl(id, channel, operation), ['name-lookup', 'show/currency-holidays'].includes(operation) ? 'POST' : 'GET', body);
    }
}
exports.H2hClient = H2hClient;
