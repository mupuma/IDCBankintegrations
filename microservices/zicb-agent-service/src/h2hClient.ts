import { PATHS, validateBatch, submissionOutcome, statusOutcome, type Channel, type Batch, type Outcome } from '../../../shared/zicb-h2h';

export type Profile = { clientId: string; clientSecret: string; authUrl: string; internalUrl: string; rtgsUrl: string; ddaccUrl: string };
type HttpResult = { status: number; body: any };
class H2hAuthenticationError extends Error {}

function authenticationConnectionError(error: unknown): string {
  // Never return raw fetch messages, URLs, response bodies or credentials.
  const hints: Record<string, string> = {
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
  const pending: unknown[] = [error];
  const seen = new Set<unknown>();
  while (pending.length && seen.size < 20) {
    const value = pending.shift();
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    const item = value as { code?: string; name?: string; cause?: unknown; errors?: unknown[] };
    if (item.code && Object.prototype.hasOwnProperty.call(hints, item.code)) return `Token request failed (${item.code}); ${hints[item.code]}`;
    if (item.name === 'AbortError' || item.name === 'TimeoutError') return 'Token request timed out; check network access and the authentication service';
    pending.push(item.cause);
    if (Array.isArray(item.errors)) pending.push(...item.errors);
  }
  return 'Token request failed; check authentication URL, network access and TLS certificates';
}
export class H2hClient {
  private tokens = new Map<string, { token: string; expires: number }>();
  private refreshing = new Map<string, Promise<string>>();
  constructor(private profiles: Record<string, Profile>, private transport: typeof fetch = fetch, private now = () => Date.now(), private timeoutMs = 90000) {}
  private profile(id: string) {
    const profile = this.profiles[id];
    if (!profile) throw new H2hAuthenticationError('No agent credentials profile matches the requested profileId; the portal source profileId must exactly match a key in agent ZICB_H2H_PROFILES');
    if (!profile.clientId || !profile.clientSecret) throw new H2hAuthenticationError('The selected agent profile is missing clientId or clientSecret in ZICB_H2H_PROFILES');
    return profile;
  }
  private url(base: string, path: string) {
    let url: URL;
    try { url = new URL(base); } catch { throw new H2hAuthenticationError('H2H base URL is missing or invalid; check the selected agent profile URLs'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new H2hAuthenticationError('H2H base URLs must use HTTPS without embedded credentials, query strings or fragments');
    return `${base.replace(/\/$/, '')}${path}`;
  }
  private async http(url: string, init: RequestInit): Promise<HttpResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.transport(url, { ...init, signal: controller.signal, redirect: 'error' });
      const text = await response.text(); // Timeout covers the response body too.
      let body: unknown;
      try { body = text ? JSON.parse(text) : null; } catch { body = null; }
      return { status: response.status, body };
    } finally { clearTimeout(timer); }
  }
  async token(id: string): Promise<string> {
    const cached = this.tokens.get(id);
    if (cached && cached.expires > this.now()) return cached.token;
    const inFlight = this.refreshing.get(id);
    if (inFlight) return inFlight;
    const promise = (async () => {
      const profile = this.profile(id);
      const authUrl = this.url(profile.authUrl, '/h2h/auth/grant-type/client-credentials');
      let result: HttpResult;
      try { result = await this.http(authUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: profile.clientId, client_secret: profile.clientSecret, grant_type: 'client_credentials' }),
      }); } catch (error) { throw new H2hAuthenticationError(authenticationConnectionError(error)); }
      if (result.status !== 200) {
        const hint = result.status === 401 ? 'check ZICB clientId and clientSecret'
          : result.status === 403 ? 'ask ZICB to check client permissions and source IP allowlisting'
          : result.status === 404 ? 'check authUrl; use the base URL, without the token endpoint appended'
          : result.status >= 500 ? 'ZICB authentication service is unavailable'
          : 'check the authentication endpoint and client configuration with ZICB';
        throw new H2hAuthenticationError(`Token request rejected (HTTP ${result.status}); ${hint}`);
      }
      if (!result.body?.access_token || result.body.token_type !== 'Bearer' || !Number.isFinite(result.body.expires_in) || result.body.expires_in <= 0) throw new H2hAuthenticationError('Token endpoint returned HTTP 200 without a valid access_token, Bearer token_type and positive numeric expires_in; confirm the endpoint and response format with ZICB');
      const lifetime = result.body.expires_in * 1000;
      this.tokens.set(id, { token: result.body.access_token, expires: this.now() + lifetime - Math.min(60000, lifetime / 10) });
      return result.body.access_token as string;
    })();
    this.refreshing.set(id, promise);
    try { return await promise; } finally { this.refreshing.delete(id); }
  }
  private async authenticated(id: string, url: string, method: string, body?: unknown): Promise<HttpResult> {
    let token = await this.token(id);
    const send = () => this.http(url, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    let result = await send();
    if (result.status === 401 && result.body?.error === 'invalid_token') {
      // Only a definite authentication rejection can replay this request.
      // Do not refresh/replay permission errors or network timeouts.
      if (this.tokens.get(id)?.token === token) this.tokens.delete(id);
      token = await this.token(id);
      result = await send();
    }
    return result;
  }
  private businessUrl(id: string, channel: Channel, operation: string) {
    const p = this.profile(id);
    const base = channel === 'INTERNAL' ? p.internalUrl : channel === 'RTGS' ? p.rtgsUrl : p.ddaccUrl;
    return this.url(base, `${PATHS[channel]}/${operation}`);
  }
  async submit(id: string, channel: Channel, batch: Batch, scale: number): Promise<Outcome> {
    const errors = validateBatch(channel, batch, scale);
    if (errors.length) return { state: 'rejected', notSent: true, notSentReason: 'validation', error: errors.join('; ') };
    // Acquire credentials before the submission boundary; a token failure sends no money.
    try { await this.token(id); } catch (error) {
      const detail = error instanceof H2hAuthenticationError ? error.message : 'Unexpected token acquisition failure; check the agent profile and authentication service';
      return { state: 'rejected', notSent: true, notSentReason: 'authentication', error: `H2H authentication/configuration failed before submission: ${detail}` };
    }
    try {
      const result = await this.authenticated(id, this.businessUrl(id, channel, 'send-money'), 'POST', batch);
      return submissionOutcome(result.status, result.body);
    } catch { return { state: 'unknown', error: 'Submission outcome unknown; reconcile the original reference before any resend' }; }
  }
  async reconcile(id: string, channel: Channel, batch: Batch): Promise<Outcome> {
    try {
      const result = await this.authenticated(id, this.businessUrl(id, channel, 'transaction-status'), 'POST', { ext_batch_ref_no: batch.reference });
      if (result.status !== 200) return { state: 'unknown', error: `Bank status unavailable (HTTP ${result.status}); original reference retained` };
      return statusOutcome(result.body, batch, channel);
    } catch { return { state: 'unknown', error: 'Bank status temporarily unavailable' }; }
  }
  async verifyToken(id: string) {
    return this.authenticated(id, this.url(this.profile(id).authUrl, '/h2h/auth/grant-type/client-credentials/verify-token'), 'GET');
  }
  async lookup(id: string, channel: Channel, operation: 'name-lookup' | 'show/other-banks-details' | 'show/currencies' | 'show/currency-holidays', body?: unknown) {
    if ((channel === 'INTERNAL') !== (operation === 'name-lookup')) throw new Error('Lookup is not supported by this channel');
    return this.authenticated(id, this.businessUrl(id, channel, operation), ['name-lookup', 'show/currency-holidays'].includes(operation) ? 'POST' : 'GET', body);
  }
}
