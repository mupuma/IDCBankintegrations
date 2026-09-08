"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startH2hService = startH2hService;
const express_1 = __importDefault(require("express"));
const h2hClient_1 = require("./h2hClient");
const h2hRunner_1 = require("./h2hRunner");
function startH2hService() {
    const profiles = JSON.parse(process.env.ZICB_H2H_PROFILES || '{}');
    if (!Object.keys(profiles).length)
        throw new Error('Configure ZICB_H2H_PROFILES before starting the H2H worker');
    const bank = new h2hClient_1.H2hClient(profiles);
    const portal = new h2hRunner_1.HttpWorkPortal(process.env.APP_API_URL || '', process.env.ZICB_H2H_AGENT_KEY || '');
    const app = (0, express_1.default)();
    app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'zicb-h2h-agent', protocol: 'h2h-v1' }));
    app.post('/payments', (_req, res) => res.status(410).json({ error: 'Submit H2H payments through the portal ledger' }));
    const server = app.listen(Number(process.env.PORT || 4001));
    let stopped = false;
    async function tick() {
        if (stopped)
            return;
        try {
            const work = await portal.claim();
            if (work)
                await (0, h2hRunner_1.processH2hWork)(work, bank, portal);
        }
        catch (error) {
            console.error('[ZICB H2H] Work interrupted; durable lease recovery will reconcile', error instanceof Error ? error.message : 'unknown error');
        }
        finally {
            if (!stopped)
                setTimeout(() => void tick(), 5000);
        }
    }
    void tick();
    const stop = () => { stopped = true; server.close(); };
    process.once('SIGTERM', stop);
    process.once('SIGINT', stop);
}
