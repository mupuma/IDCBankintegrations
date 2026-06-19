import type { PaymentsResponse } from '../../models/dtos';
import { buildZicbPayload } from './payloadBuilders';
import { resolveSourceBank } from '@/app/lib/sourceAccounts';

export { resolveSourceBank };

const QUEUE_URL = process.env.ZICB_BANK_API_URL;

function mergeZicbDefaults(payment: PaymentsResponse, source?: { name?: string | null }) {
  const p = { ...payment };

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
