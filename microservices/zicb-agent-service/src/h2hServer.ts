import express from 'express';
import { H2hClient } from './h2hClient';
import { HttpWorkPortal, processH2hWork } from './h2hRunner';
import { callbackRoutes, handleBankCallback } from './h2hCallback';

export function startH2hService() {
  const profiles = JSON.parse(process.env.ZICB_H2H_PROFILES || '{}');
  if (!Object.keys(profiles).length) throw new Error('Configure ZICB_H2H_PROFILES before starting the H2H worker');
  const bank = new H2hClient(profiles);
  const portal = new HttpWorkPortal(process.env.APP_API_URL || '', process.env.ZICB_H2H_AGENT_KEY || '');
  const app = express();
  app.use(express.json());
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'zicb-h2h-agent', protocol: 'h2h-v1' }));
  app.post('/payments', (_req, res) => res.status(410).json({ error: 'Submit H2H payments through the portal ledger' }));
  for (const route of callbackRoutes()) {
    app.post(route.path, async (req, res) => {
      const result = await handleBankCallback(route, req.headers, req.body, portal);
      res.status(result.status).json(result.body);
    });
  }
  const server = app.listen(Number(process.env.PORT || 4001));
  let stopped = false;
  async function tick() {
    if (stopped) return;
    try {
      const work = await portal.claim();
      if (work) await processH2hWork(work, bank, portal);
    } catch (error) {
      console.error('[ZICB H2H] Work interrupted; durable lease recovery will reconcile', error instanceof Error ? error.message : 'unknown error');
    } finally { if (!stopped) setTimeout(() => void tick(), 5000); }
  }
  void tick();
  const stop = () => { stopped = true; server.close(); };
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
}
