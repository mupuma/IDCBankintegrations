"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZanacoClient = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const log_1 = require("./log");
class ZanacoClient {
    constructor(config = loadZanacoConfig()) {
        this.config = config;
    }
    async send(prepared) {
        const headers = { 'Content-Type': 'application/json' };
        const bodyText = prepared.request ? compactJson(prepared.request) : '';
        (0, log_1.logEvent)('zws.request.prepare', {
            service: prepared.service,
            endpoint: prepared.endpoint,
            method: prepared.method,
            transferType: prepared.transferType,
            externalTranRef: prepared.externalTranRef,
            hasBody: Boolean(bodyText),
        });
        if (prepared.endpoint.includes('/zws-auth-service/')) {
            if (bodyText)
                headers.signature = this.sign(bodyText);
        }
        else {
            const token = await this.getAccessToken();
            headers.Authorization = `Bearer ${token}`;
            if (bodyText)
                headers.signature = this.sign(bodyText);
        }
        let response;
        try {
            response = await fetch(`${this.config.baseUrl}${prepared.endpoint}`, {
                method: prepared.method,
                headers,
                body: prepared.method === 'GET' ? undefined : bodyText || undefined,
            });
        }
        catch (error) {
            (0, log_1.logError)('zws.request.failed', {
                service: prepared.service,
                endpoint: prepared.endpoint,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
        const text = await response.text();
        const data = parseResponseBody(text);
        (0, log_1.logEvent)('zws.response.received', {
            service: prepared.service,
            endpoint: prepared.endpoint,
            status: response.status,
            ok: response.ok,
            bodyType: typeof data,
        });
        this.verifyResponse(text, data, response.headers.get('signature'));
        return { status: response.status, ok: response.ok, data };
    }
    async getAccessToken() {
        if (this.tokenRequest)
            return this.tokenRequest;
        const skewMs = Number(process.env.ZANACO_TOKEN_REFRESH_SKEW_MS || 120000);
        if (this.token && Date.now() + skewMs < this.token.expiresAt) {
            (0, log_1.logEvent)('zws.auth.token_reused');
            return this.token.accessToken;
        }
        this.tokenRequest = this.authenticate();
        try {
            return await this.tokenRequest;
        }
        finally {
            this.tokenRequest = undefined;
        }
    }
    async authenticate() {
        if (this.token?.refreshToken) {
            try {
                (0, log_1.logEvent)('zws.auth.refresh_started');
                await this.refreshToken();
                if (this.token) {
                    (0, log_1.logEvent)('zws.auth.refresh_succeeded');
                    return this.token.accessToken;
                }
            }
            catch (error) {
                (0, log_1.logError)('zws.auth.refresh_failed', { error: error instanceof Error ? error.message : String(error) });
            }
        }
        (0, log_1.logEvent)('zws.auth.login_started');
        await this.login();
        if (!this.token)
            throw new Error('Zanaco authentication did not return an access token');
        (0, log_1.logEvent)('zws.auth.login_succeeded');
        return this.token.accessToken;
    }
    async login() {
        const data = await this.authRequest('/zws-auth-service/v1.0/token', {
            apiKey: this.config.apiKey,
            grantType: 'login',
            accessKey: this.config.accessKey,
            apiSecret: this.config.apiSecret,
        });
        this.setToken(data);
    }
    async refreshToken() {
        const data = await this.authRequest('/zws-auth-service/v1.0/token/refresh', {
            apiKey: this.config.apiKey,
            grantType: 'refresh_token',
            accessKey: this.config.accessKey,
            apiSecret: this.config.apiSecret,
            refreshToken: this.token?.refreshToken,
        });
        this.setToken(data);
    }
    async authRequest(endpoint, payload) {
        const bodyText = compactJson(payload);
        (0, log_1.logEvent)('zws.auth.request', { endpoint, grantType: payload.grantType });
        const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                signature: this.sign(bodyText),
            },
            body: bodyText,
        });
        const text = await response.text();
        const data = parseResponseBody(text);
        this.verifyResponse(text, data, response.headers.get('signature'));
        if (!response.ok) {
            (0, log_1.logError)('zws.auth.response_error', { endpoint, status: response.status, body: text });
            throw new Error(`Zanaco authentication failed (${response.status}): ${text}`);
        }
        (0, log_1.logEvent)('zws.auth.response', { endpoint, status: response.status });
        return data;
    }
    setToken(data) {
        const response = data && typeof data === 'object' ? data.response : undefined;
        const accessToken = String(response?.accessToken ?? '');
        const refreshToken = String(response?.refreshToken ?? '');
        if (!accessToken || !refreshToken)
            throw new Error('Zanaco authentication response missing token fields');
        const ttlMs = Number(process.env.ZANACO_ACCESS_TOKEN_TTL_MS || 30 * 60 * 1000);
        this.token = { accessToken, refreshToken, expiresAt: Date.now() + ttlMs };
    }
    sign(data) {
        try {
            const signature = node_crypto_1.default.sign('RSA-SHA256', Buffer.from(data, 'utf8'), normalizePem(this.config.partnerPrivateKey)).toString('base64');
            (0, log_1.logEvent)('zws.sign.succeeded', { bytes: Buffer.byteLength(data, 'utf8') });
            return signature;
        }
        catch (error) {
            (0, log_1.logError)('zws.sign.failed', { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }
    verify(data, signature) {
        const ok = node_crypto_1.default.verify('RSA-SHA256', Buffer.from(data, 'utf8'), normalizePem(this.config.zanacoPublicKey), Buffer.from(signature, 'base64'));
        if (!ok)
            throw new Error('Zanaco response signature verification failed');
        (0, log_1.logEvent)('zws.verify.succeeded', { bytes: Buffer.byteLength(data, 'utf8') });
    }
    verifyResponse(text, data, headerSignature) {
        if (!text)
            return;
        const bodySignature = data && typeof data === 'object'
            ? String(data.signature ?? '')
            : '';
        const signature = headerSignature || bodySignature;
        if (!signature) {
            if (this.config.requireResponseSignature) {
                throw new Error('Zanaco response missing required signature');
            }
            (0, log_1.logEvent)('zws.verify.skipped', { reason: 'missing_signature' });
            return;
        }
        if (headerSignature) {
            this.verify(text, headerSignature);
            return;
        }
        const signedBody = signedResponseBody(data, text);
        this.verify(signedBody, bodySignature);
    }
}
exports.ZanacoClient = ZanacoClient;
function loadZanacoConfig() {
    const requireResponseSignature = process.env.ZANACO_REQUIRE_RESPONSE_SIGNATURE !== 'false';
    const required = {
        baseUrl: process.env.ZANACO_BASE_URL?.trim().replace(/\/$/, '') || 'https://uat-zws.zanaco.co.zm',
        apiKey: process.env.ZANACO_API_KEY?.trim() || '',
        accessKey: process.env.ZANACO_ACCESS_KEY?.trim() || '',
        apiSecret: process.env.ZANACO_API_SECRET?.trim() || '',
        partnerPrivateKey: process.env.ZANACO_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
        zanacoPublicKey: process.env.ZANACO_PUBLIC_KEY?.replace(/\\n/g, '\n') || '',
        requireResponseSignature,
    };
    for (const [key, value] of Object.entries(required)) {
        if (key === 'requireResponseSignature')
            continue;
        if (key === 'zanacoPublicKey' && !requireResponseSignature)
            continue;
        if (!value)
            throw new Error(`Missing required Zanaco config: ${key}`);
    }
    return required;
}
function compactJson(value) {
    return JSON.stringify(value);
}
function parseResponseBody(text) {
    if (!text)
        return undefined;
    try {
        return JSON.parse(text);
    }
    catch {
        return text;
    }
}
function signedResponseBody(data, fallback) {
    if (!data || typeof data !== 'object')
        return fallback;
    const record = data;
    return record.response === undefined ? fallback : compactJson(record.response);
}
function normalizePem(value) {
    return value.replace(/\\n/g, '\n');
}
