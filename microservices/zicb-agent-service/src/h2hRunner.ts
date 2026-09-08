import { H2hClient } from './h2hClient';
import type { Batch, Channel, Outcome } from '../../../shared/zicb-h2h';

export type H2hWork = { queueId: string; leaseToken: string; action: 'submit' | 'reconcile' | 'accounting'; profileId: string; channel: Channel; batch: Batch; amountScale: number };
export interface WorkPortal {
  claim(): Promise<H2hWork | null>;
  report(work: H2hWork, outcome: Outcome): Promise<void>;
  account(work: H2hWork): Promise<void>;
}
// The bank call is outside the reporting retry loop. If all report attempts fail,
// the database lease expires into reconciliation, not another bank submission.
export async function processH2hWork(work: H2hWork, bank: Pick<H2hClient, 'submit' | 'reconcile'>, portal: WorkPortal) {
  if (work.action === 'accounting') { await portal.account(work); return; }
  const outcome = work.action === 'submit'
    ? await bank.submit(work.profileId, work.channel, work.batch, work.amountScale)
    : await bank.reconcile(work.profileId, work.channel, work.batch);
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try { await portal.report(work, outcome); return; } catch (error) { lastError = error; }
  }
  throw lastError;
}

export class HttpWorkPortal implements WorkPortal {
  constructor(private base: string, private key: string, private transport: typeof fetch = fetch) {
    if (!base || !key) throw new Error('APP_API_URL and ZICB_H2H_AGENT_KEY are required');
  }
  private async request(path: string, method: string, body?: unknown) {
    const response = await this.transport(`${this.base.replace(/\/$/, '')}/api/v1/zicb/h2h/${path}`, {
      method, headers: { 'Content-Type': 'application/json', 'x-zicb-agent-key': this.key },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(120000), redirect: 'error',
    });
    if (!response.ok) throw new Error(`H2H portal ${path} failed (HTTP ${response.status})`);
    return response.json() as Promise<any>;
  }
  async claim() { return (await this.request('work', 'POST')).item as H2hWork | null; }
  async report(work: H2hWork, outcome: Outcome) { await this.request('work', 'PATCH', { queueId: work.queueId, leaseToken: work.leaseToken, outcome }); }
  async account(work: H2hWork) { await this.request('accounting', 'POST', { queueId: work.queueId, leaseToken: work.leaseToken }); }
}
