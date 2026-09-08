import { PATHS, validateBatch, submissionOutcome, statusOutcome, type Channel, type Batch, type Outcome } from '../../../shared/zicb-h2h';

export type Profile = { clientId: string; clientSecret: string; authUrl: string; internalUrl: string; rtgsUrl: string; ddaccUrl: string };
type HttpResult = { status: number; body: any };
export class H2hClient {
  private tokens = new Map<string, { token: string; expires: number }>();
  private refreshing = new Map<string, Promise<string>>();
  constructor(private profiles: Record<string, Profile>, private transport: typeof fetch = fetch, private now = () => Date.now(), private timeoutMs = 90000) {}
  private profile(id: string) {
    const profile = this.profiles[id];
    if (!profile?.clientId || !profile.clientSecret) throw new Error('H2H profile credentials are not configured');
    return profile;
  }
  private url(base: string, path: string) {
    const url = new URL(base);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('H2H base URLs must use HTTPS without embedded credentials');
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
      const result = await this.http(this.url(profile.authUrl, '/h2h/auth/grant-type/client-credentials'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: profile.clientId, client_secret: profile.clientSecret, grant_type: 'client_credentials' }),
      });
      if (result.status !== 200 || !result.body?.access_token || result.body.token_type !== 'Bearer' || !Number.isFinite(result.body.expires_in) || result.body.expires_in <= 0) throw new Error('Unable to acquire a valid H2H access token');
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
    if (errors.length) return { state: 'rejected', error: errors.join('; ') };
    // Acquire credentials before the submission boundary; a token failure sends no money.
    try { await this.token(id); } catch { return { state: 'rejected', error: 'H2H authentication/configuration failed before submission' }; }
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
