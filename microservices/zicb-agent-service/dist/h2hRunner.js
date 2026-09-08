"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpWorkPortal = void 0;
exports.processH2hWork = processH2hWork;
// The bank call is outside the reporting retry loop. If all report attempts fail,
// the database lease expires into reconciliation, not another bank submission.
async function processH2hWork(work, bank, portal) {
    if (work.action === 'accounting') {
        await portal.account(work);
        return;
    }
    const outcome = work.action === 'submit'
        ? await bank.submit(work.profileId, work.channel, work.batch, work.amountScale)
        : await bank.reconcile(work.profileId, work.channel, work.batch);
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            await portal.report(work, outcome);
            return;
        }
        catch (error) {
            lastError = error;
        }
    }
    throw lastError;
}
class HttpWorkPortal {
    constructor(base, key, transport = fetch) {
        this.base = base;
        this.key = key;
        this.transport = transport;
        if (!base || !key)
            throw new Error('APP_API_URL and ZICB_H2H_AGENT_KEY are required');
    }
    async request(path, method, body) {
        const response = await this.transport(`${this.base.replace(/\/$/, '')}/api/v1/zicb/h2h/${path}`, {
            method, headers: { 'Content-Type': 'application/json', 'x-zicb-agent-key': this.key },
            body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(120000), redirect: 'error',
        });
        if (!response.ok)
            throw new Error(`H2H portal ${path} failed (HTTP ${response.status})`);
        return response.json();
    }
    async claim() { return (await this.request('work', 'POST')).item; }
    async report(work, outcome) { await this.request('work', 'PATCH', { queueId: work.queueId, leaseToken: work.leaseToken, outcome }); }
    async account(work) { await this.request('accounting', 'POST', { queueId: work.queueId, leaseToken: work.leaseToken }); }
}
exports.HttpWorkPortal = HttpWorkPortal;
