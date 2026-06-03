import type { PaymentsResponse } from '../../models/dtos';
import { buildIzbPayload } from './payloadBuilders';
import { connectSageDatabase } from '@/app/lib/sageDb';
import { Bkacct } from '@/app/models/sage_entities/Bkacct';

const QUEUE_URL = process.env.IZB_BANK_API_URL;

async function postToQueue(payload: unknown) {
  if (!QUEUE_URL) {
    throw new Error('Missing IZB_BANK_API_URL environment variable');
  }

  const response = await fetch(QUEUE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data: unknown;

  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }

  return {
    success: response.ok,
    status: response.status,
    data,
    error: response.ok ? undefined : `IZB queue request failed with status ${response.status}`,
  };
}

export async function resolveSourceBank(bankCode?: string | null) {
  if (!bankCode) return null;
  try {
    await connectSageDatabase();
    const bk = await Bkacct.findOne({ where: { bank: bankCode } });
    if (!bk) return null;
    const r = (bk as any).toJSON ? (bk as any).toJSON() : bk;
    return {
      bank: r.BANK || r.bank,
      name: r.NAME || r.name,
      accountNumber: r.BKACCT || r.bkacct,
      addr1: r.ADDR1 || r.addr1,
      addr2: r.ADDR2 || r.addr2,
      addr3: r.ADDR3 || r.addr3,
      addr4: r.ADDR4 || r.addr4,
      city: r.CITY || r.city,
      state: r.STATE || r.state,
      country: r.COUNTRY || r.country,
      postal: r.POSTAL || r.postal,
      contact: r.CONTACT || r.contact,
      phone: r.PHONE || r.phone,
      fax: r.FAX || r.fax,
      transit: r.TRANSIT || r.transit,
      idacct: r.IDACCT || r.idacct,
    };
  } catch (err) {
    console.warn('Failed to resolve source bank', err);
    return null;
  }
}

export function createIzbPayload(payment: PaymentsResponse, sourceBank?: any) {
  return buildIzbPayload(payment, payment.transactionType, sourceBank);
}

export async function sendIzbPayment(payment: PaymentsResponse, sourceBank?: string | null) {
  const src = sourceBank ? await resolveSourceBank(sourceBank) : null;
  const payload = buildIzbPayload(payment, payment.transactionType, src || undefined);
  return postToQueue(payload);
}
