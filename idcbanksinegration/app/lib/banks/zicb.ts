import type { PaymentsResponse } from '../../models/dtos';
import { buildZicbPayload } from './payloadBuilders';
import { connectSageDatabase } from '@/app/lib/sageDb';
import { Bkacct } from '@/app/models/sage_entities/Bkacct';

const QUEUE_URL = process.env.ZICB_BANK_API_URL;
const DEFAULT_SOURCE_ACCOUNT = process.env.ZICB_SOURCE_ACCOUNT ?? '';
const DEFAULT_SOURCE_BRANCH = process.env.ZICB_SOURCE_BRANCH ?? '';
const DEFAULT_USER_NAME = process.env.ZICB_USER_NAME ?? 'SageSystem';
const DEFAULT_CUSTOMER_ID = process.env.ZICB_CUSTOMER_ID ?? '';
const DEFAULT_IP_ADDRESS = process.env.ZICB_IP_ADDRESS ?? '0.0.0.0';

async function resolveSourceBank(bankCode?: string | null) {
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

function mergeZicbDefaults(payment: PaymentsResponse, source?: any) {
  let p = { ...payment };
  if (source?.accountNumber) {
    p.accountNumber = p.accountNumber || source.accountNumber || DEFAULT_SOURCE_ACCOUNT;
  } else if (DEFAULT_SOURCE_ACCOUNT) {
    p.accountNumber = p.accountNumber || DEFAULT_SOURCE_ACCOUNT;
  }

  if (source?.transit) {
    p.branchCode = p.branchCode || source.transit || DEFAULT_SOURCE_BRANCH;
  } else if (DEFAULT_SOURCE_BRANCH) {
    p.branchCode = p.branchCode || DEFAULT_SOURCE_BRANCH;
  }

  if (source?.name) {
    p.accountName = p.accountName || source.name;
  }

  if (!p.transactionDate) p.transactionDate = new Date();
  return p;
}

async function postToQueue(payload: unknown) {
  if (!QUEUE_URL) {
    throw new Error('Missing ZICB_BANK_API_URL environment variable');
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
    deferred: response.status === 202,
    error: response.ok ? undefined : `ZICB queue request failed with status ${response.status}`,
  };
}

export async function createZicbPayload(payment: PaymentsResponse, sourceBank?: string | null) {
  const src = sourceBank ? await resolveSourceBank(sourceBank) : null;
  return buildZicbPayload(mergeZicbDefaults(payment, src || undefined), payment.transactionType, src || undefined);
}

export async function sendZicbPayment(payment: PaymentsResponse, queueId?: string, sourceBank?: string | null) {
  const src = sourceBank ? await resolveSourceBank(sourceBank) : null;
  const payload = buildZicbPayload(mergeZicbDefaults(payment, src || undefined), payment.transactionType, src || undefined);

  if (queueId) {
    return postToQueue({ ...payload, queueId });
  }

  return postToQueue(payload);
}
