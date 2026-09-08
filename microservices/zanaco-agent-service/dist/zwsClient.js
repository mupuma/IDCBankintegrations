"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZanacoClient = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
class ZanacoClient {
    constructor(config = loadZanacoConfig()) {
        this.config = config;
    }
    async send(prepared) {
        const headers = { 'Content-Type': 'application/json' };
        const bodyText = prepared.request ? compactJson(prepared.request) : '';
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
        const response = await fetch(`${this.config.baseUrl}${prepared.endpoint}`, {
            method: prepared.method,
            headers,
            body: prepared.method === 'GET' ? undefined : bodyText || undefined,
        });
        const text = await response.text();
        const data = parseResponseBody(text);
        const responseSignature = response.headers.get('signature') || (data && typeof data === 'object' ? String(data.signature ?? '') : '');
        if (this.config.zanacoPublicKey && responseSignature && text) {
            this.verify(text, responseSignature);
        }
        return { status: response.status, ok: response.ok, data };
    }
    async getAccessToken() {
        const skewMs = Number(process.env.ZANACO_TOKEN_REFRESH_SKEW_MS || 120000);
        if (this.token && Date.now() + skewMs < this.token.expiresAt)
            return this.token.accessToken;
        if (this.token?.refreshToken) {
            try {
                await this.refreshToken();
                if (this.token)
                    return this.token.accessToken;
            }
            catch (error) {
                console.warn('[ZANACO] Token refresh failed, attempting login', error);
            }
        }
        await this.login();
        if (!this.token)
            throw new Error('Zanaco authentication did not return an access token');
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
        if (!response.ok)
            throw new Error(`Zanaco authentication failed (${response.status}): ${text}`);
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
        return node_crypto_1.default.sign('RSA-SHA256', Buffer.from(data, 'utf8'), normalizePem(this.config.partnerPrivateKey)).toString('base64');
    }
    verify(data, signature) {
        const ok = node_crypto_1.default.verify('RSA-SHA256', Buffer.from(data, 'utf8'), normalizePem(this.config.zanacoPublicKey), Buffer.from(signature, 'base64'));
        if (!ok)
            throw new Error('Zanaco response signature verification failed');
    }
}
exports.ZanacoClient = ZanacoClient;
function loadZanacoConfig() {
    const required = {
        baseUrl: process.env.ZANACO_BASE_URL?.trim().replace(/\/$/, '') || 'https://uat-zws.zanaco.co.zm',
        apiKey: process.env.ZANACO_API_KEY?.trim() || '',
        accessKey: process.env.ZANACO_ACCESS_KEY?.trim() || '',
        apiSecret: process.env.ZANACO_API_SECRET?.trim() || '',
        partnerPrivateKey: process.env.ZANACO_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
        zanacoPublicKey: process.env.ZANACO_PUBLIC_KEY?.replace(/\\n/g, '\n') || '',
    };
    for (const [key, value] of Object.entries(required)) {
        if (key !== 'zanacoPublicKey' && !value)
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
function normalizePem(value) {
    return value.replace(/\\n/g, '\n');
}
