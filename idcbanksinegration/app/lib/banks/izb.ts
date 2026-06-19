import type { PaymentsResponse } from '../../models/dtos';
import { buildIzbPayload } from './payloadBuilders';
import { resolveSourceBank } from '@/app/lib/sourceAccounts';

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

export function createIzbPayload(payment: PaymentsResponse, sourceBank?: { accountNumber?: string | null; transit?: string | null; name?: string | null }) {
  return buildIzbPayload(payment, payment.transactionType, sourceBank);
}

export async function sendIzbPayment(payment: PaymentsResponse, sourceBank?: string | null) {
  const src = sourceBank ? await resolveSourceBank(sourceBank) : null;
  const payload = buildIzbPayload(payment, payment.transactionType, src || undefined);
  return postToQueue(payload);
}
