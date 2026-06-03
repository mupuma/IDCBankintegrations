import fetch from 'node-fetch';

// Agents should call the main portal (idcbankintegration) which will talk to Sage.
const APP_API_URL = process.env.APP_API_URL?.replace(/\/$/, '');
const SAGE_API_KEY = process.env.SAGE_API_KEY; // optional if portal requires auth

export type ReceiptRequest = {
  transactionId: string;
  bankCode: string;
  Description: string;
  noEntries: number;
  creditAmount: number;
  debitAmount: number;
  entries: Array<{
    entryNo: number;
    referenceNo?: string;
    customerNo?: string;
    noDetails: number;
    amount: number;
    currency?: string;
    details: Array<{
      entryDescription?: string;
      accountId?: string;
      amount: number;
      DrCr?: 'Dr' | 'Cr';
      detailNo?: number;
    }>;
  }>;
};

export async function postCashbook(receipt: ReceiptRequest) {
  if (!APP_API_URL) {
    throw new Error('APP_API_URL not configured');
  }

  // Call the portal's cashbook endpoint; the portal will handle writing to Sage
  const url = `${APP_API_URL}/api/v1/cashbook`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (SAGE_API_KEY) headers['Authorization'] = `Bearer ${SAGE_API_KEY}`;

  const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(receipt) });
  const text = await resp.text();
  let data: unknown = text;
  try { data = text ? JSON.parse(text) : undefined; } catch {}

  return {
    ok: resp.ok,
    status: resp.status,
    data,
    text,
  };
}

export default { postCashbook };
