import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
//import { paymentQueue } from './queue';
import { initDatabase } from './db';
//import type { PaymentJobPayload, PaymentsResponse } from './types';




dotenv.config();
initDatabase();

const app = express();

const APP_API_URL = process.env.APP_API_URL?.replace(/\/$/, '') || null;
const PORTAL_API_KEY = process.env.BANK_PULL_API_KEY || null; // key used when agent calls portal
const AGENT_API_KEY = process.env.AGENT_API_KEY || null; // key banks must use when calling this agent
const port = Number(process.env.PORT || 4101);

app.use(cors());
app.use(express.json());

function isIzbServicePayload(value: unknown): value is { service: string; request: Record<string, unknown> } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as any).service === 'string' &&
    typeof (value as any).request === 'object' &&
    (value as any).request !== null
  );
}

function normalizePortalItems(portalJson: unknown): unknown[] {
  if (!portalJson) return [];
  if (Array.isArray(portalJson)) return portalJson;
  if (typeof portalJson !== 'object') return [portalJson];

  const record = portalJson as Record<string, unknown>;
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.data)) return record.data;
  if (Array.isArray(record.payments)) return record.payments;

  return [portalJson];
}

function mapItem(it: unknown) {
  const record = (typeof it === 'object' && it !== null ? it : {}) as Record<string, unknown>;
  const p = (typeof record.payment === 'object' && record.payment !== null ? record.payment : record) as Record<string, unknown>;
  const get = (keys: string[]) => {
    for (const key of keys) {
      if (p[key] !== undefined) return p[key];
      if (record[key] !== undefined) return record[key];
    }
    return null;
  };

  return {
    accountNumber: get(['accountNumber', 'account_number', 'acctNumber', 'acct_no']) ?? '',
    amount: Number(get(['amount', 'value', 'amt'])) || 0,
    currency: get(['currency', 'currencyCode', 'currency_code']) || 'USD',
    remarks: get(['remarks', 'remark', 'narration', 'description']) || '',
    vendorId: get(['vendorId', 'vendor_id', 'vendor']) || '',
    accountName: get(['accountName', 'account_name', 'name']) || '',
    branchCode: get(['branchCode', 'branch_code']) || '',
    sortCode: get(['sortCode', 'sort_code']) || '',
    currencyCode: get(['currencyCode', 'currency_code', 'currency']) || 'USD',
    transactionDate: get(['transactionDate', 'transaction_date', 'date', 'paymentDate']) || null,
    transactionType: get(['transactionType', 'transaction_type', 'type']) || '',
    physicalAddress: get(['physicalAddress', 'address', 'physical_address']) || '',
    countryOfOrigin: get(['countryOfOrigin', 'country_of_origin', 'country']) || '',
    swiftCode: get(['swiftCode', 'swift_code']) || '',
    transactionReference: get(['transactionReference', 'transaction_reference', 'reference', 'transactionRef']) || '',
    bankName: get(['bankName', 'bank_name', 'bank']) || '',
  };
}

app.post('/api/v1/payments/by_date', async (req, res) => {
  try {
    const providedKey = String(req.headers['x-api-key'] || '');
    if (!AGENT_API_KEY || providedKey !== AGENT_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized from IZB Agent Service' });
    }

    if (!APP_API_URL) return res.status(500).json({ error: 'Portal APP_API_URL not configured' });

    const { startDate, endDate } = req.body || {};
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate and endDate required' });

    const parseYYYYMMDD = (v: number | string) => {
      const s = String(v);
      if (s.length !== 8) return null;
      return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
    };

    const from = parseYYYYMMDD(startDate);
    const to = parseYYYYMMDD(endDate);
    if (!from || !to) return res.status(400).json({ error: 'Invalid date format; expected YYYYMMDD integers' });

    const url = new URL(`${APP_API_URL}/api/v1/izb/pull`);
    url.searchParams.set('from', from);
    url.searchParams.set('to', to);

    const resp = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-bank-api-key': PORTAL_API_KEY ?? '',
      },
    });

    const portalJson = await (async () => {
      try { return await resp.json(); } catch { return null; }
    })();

    const items = normalizePortalItems(portalJson);
    const mapped = items.map(mapItem);

    return res.status(200).json({
      responseCode: '200',
      responseMessage: 'success',
      timeStamp: new Date().toISOString(),
      data: mapped,
    });
  } catch (err:any) {
    console.error('payments/by_date proxy error', err);
    return res.status(500).json({ error: String(err) });
  }
});

// Bank-facing cashbook endpoint (Sage API contract)
app.post('/api/v1/postCBTxn', proxyPostCashbook);


async function proxyPostCashbook(req: express.Request, res: express.Response) {
  try {
    const providedKey = String(req.headers['x-api-key'] || '');
    if (!AGENT_API_KEY || providedKey !== AGENT_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!APP_API_URL) return res.status(500).json({ error: 'Portal APP_API_URL not configured' });

    const resp = await fetch(`${APP_API_URL}/api/v1/postCBTxn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bank-api-key': PORTAL_API_KEY ?? '',
      },
      body: JSON.stringify(req.body),
    });

    const text = await resp.text();
    let data: unknown = text;
    try { data = text ? JSON.parse(text) : undefined; } catch {}

    if (typeof data === 'object' && data !== null) {
      return res.status(resp.status).json(data);
    }

    return res.status(resp.status).send(text);
  } catch (err: any) {
    console.error('Cashbook proxy error', err);
    return res.status(500).json({ error: String(err) });
  }
}
// Backward-compatible alias
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'izb-agent-service' });
});

app.listen(port, () => {
  console.log(`IZB agent service running on http://localhost:${port}`);
  console.log('Bank-facing: POST /api/v1/postCBTxn, POST /api/v1/payments/by_date');
});
