import crypto from 'node:crypto';
import type { ZanacoPreparedRequest } from './types';
import { logEvent, logError } from './log';

type TokenState = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

type ZanacoConfig = {
  baseUrl: string;
  apiKey: string;
  accessKey: string;
  apiSecret: string;
  partnerPrivateKey: string;
  zanacoPublicKey: string;
  requireResponseSignature: boolean;
};

export class ZanacoClient {
  private token?: TokenState;
  private tokenRequest?: Promise<string>;

  constructor(private readonly config = loadZanacoConfig()) {}

  async send(prepared: ZanacoPreparedRequest) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const bodyText = prepared.request ? compactJson(prepared.request) : '';
    logEvent('zws.request.prepare', {
      service: prepared.service,
      endpoint: prepared.endpoint,
      method: prepared.method,
      transferType: prepared.transferType,
      externalTranRef: prepared.externalTranRef,
      hasBody: Boolean(bodyText),
    });

    if (prepared.endpoint.includes('/zws-auth-service/')) {
      if (bodyText) headers.signature = this.sign(bodyText);
    } else {
      const token = await this.getAccessToken();
      headers.Authorization = `Bearer ${token}`;
      if (bodyText) headers.signature = this.sign(bodyText);
    }

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}${prepared.endpoint}`, {
        method: prepared.method,
        headers,
        body: prepared.method === 'GET' ? undefined : bodyText || undefined,
      });
    } catch (error) {
      logError('zws.request.failed', {
        service: prepared.service,
        endpoint: prepared.endpoint,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    const text = await response.text();
    const data = parseResponseBody(text);
    logEvent('zws.response.received', {
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
    if (this.tokenRequest) return this.tokenRequest;

    const skewMs = Number(process.env.ZANACO_TOKEN_REFRESH_SKEW_MS || 120000);
    if (this.token && Date.now() + skewMs < this.token.expiresAt) {
      logEvent('zws.auth.token_reused');
      return this.token.accessToken;
    }

    this.tokenRequest = this.authenticate();
    try {
      return await this.tokenRequest;
    } finally {
      this.tokenRequest = undefined;
    }
  }

  private async authenticate() {
    if (this.token?.refreshToken) {
      try {
        logEvent('zws.auth.refresh_started');
        await this.refreshToken();
        if (this.token) {
          logEvent('zws.auth.refresh_succeeded');
          return this.token.accessToken;
        }
      } catch (error) {
        logError('zws.auth.refresh_failed', { error: error instanceof Error ? error.message : String(error) });
      }
    }
    logEvent('zws.auth.login_started');
    await this.login();
    if (!this.token) throw new Error('Zanaco authentication did not return an access token');
    logEvent('zws.auth.login_succeeded');
    return this.token.accessToken;
  }

  private async login() {
    const data = await this.authRequest('/zws-auth-service/v1.0/token', {
      apiKey: this.config.apiKey,
      grantType: 'login',
      accessKey: this.config.accessKey,
      apiSecret: this.config.apiSecret,
    });
    this.setToken(data);
  }

  private async refreshToken() {
    const data = await this.authRequest('/zws-auth-service/v1.0/token/refresh', {
      apiKey: this.config.apiKey,
      grantType: 'refresh_token',
      accessKey: this.config.accessKey,
      apiSecret: this.config.apiSecret,
      refreshToken: this.token?.refreshToken,
    });
    this.setToken(data);
  }

  private async authRequest(endpoint: string, payload: Record<string, unknown>) {
    const bodyText = compactJson(payload);
    logEvent('zws.auth.request', { endpoint, grantType: payload.grantType });
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
      logError('zws.auth.response_error', { endpoint, status: response.status, body: text });
      throw new Error(`Zanaco authentication failed (${response.status}): ${text}`);
    }
    logEvent('zws.auth.response', { endpoint, status: response.status });
    return data;
  }

  private setToken(data: unknown) {
    const response = data && typeof data === 'object' ? (data as { response?: Record<string, unknown> }).response : undefined;
    const accessToken = String(response?.accessToken ?? '');
    const refreshToken = String(response?.refreshToken ?? '');
    if (!accessToken || !refreshToken) throw new Error('Zanaco authentication response missing token fields');
    const ttlMs = Number(process.env.ZANACO_ACCESS_TOKEN_TTL_MS || 30 * 60 * 1000);
    this.token = { accessToken, refreshToken, expiresAt: Date.now() + ttlMs };
  }

  private sign(data: string) {
    try {
      const signature = crypto.sign('RSA-SHA256', Buffer.from(data, 'utf8'), normalizePem(this.config.partnerPrivateKey)).toString('base64');
      logEvent('zws.sign.succeeded', { bytes: Buffer.byteLength(data, 'utf8') });
      return signature;
    } catch (error) {
      logError('zws.sign.failed', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  private verify(data: string, signature: string) {
    const ok = crypto.verify('RSA-SHA256', Buffer.from(data, 'utf8'), normalizePem(this.config.zanacoPublicKey), Buffer.from(signature, 'base64'));
    if (!ok) throw new Error('Zanaco response signature verification failed');
    logEvent('zws.verify.succeeded', { bytes: Buffer.byteLength(data, 'utf8') });
  }

  private verifyResponse(text: string, data: unknown, headerSignature: string | null) {
    if (!text) return;

    const bodySignature = data && typeof data === 'object'
      ? String((data as { signature?: unknown }).signature ?? '')
      : '';
    const signature = headerSignature || bodySignature;

    if (!signature) {
      if (this.config.requireResponseSignature) {
        throw new Error('Zanaco response missing required signature');
      }
      logEvent('zws.verify.skipped', { reason: 'missing_signature' });
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

function loadZanacoConfig(): ZanacoConfig {
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
    if (key === 'requireResponseSignature') continue;
    if (key === 'zanacoPublicKey' && !requireResponseSignature) continue;
    if (!value) throw new Error(`Missing required Zanaco config: ${key}`);
  }
  return required;
}

function compactJson(value: unknown) {
  return JSON.stringify(value);
}

function parseResponseBody(text: string) {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function signedResponseBody(data: unknown, fallback: string) {
  if (!data || typeof data !== 'object') return fallback;
  const record = data as { response?: unknown };
  return record.response === undefined ? fallback : compactJson(record.response);
}

function normalizePem(value: string) {
  return value.replace(/\\n/g, '\n');
}
