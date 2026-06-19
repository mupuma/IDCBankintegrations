import type { PaymentsResponse } from '../../models/dtos';
import { buildZanacoPayload } from './payloadBuilders';
import { resolveSourceBank } from '@/app/lib/sourceAccounts';

const QUEUE_URL = process.env.ZANACO_BANK_API_URL;

async function postToQueue(payload: unknown) {
  if (!QUEUE_URL) {
    throw new Error('Missing ZANACO_BANK_API_URL environment variable');
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
    error: response.ok ? undefined : `Zanaco queue request failed with status ${response.status}`,
  };
}

export function createZanacoPayload(payment: PaymentsResponse, sourceBank?: { accountNumber?: string | null; transit?: string | null; name?: string | null }) {
  return buildZanacoPayload(payment, payment.transactionType, sourceBank);
}

export async function sendZanacoPayment(payment: PaymentsResponse, sourceBank?: string | null) {
  const src = sourceBank ? await resolveSourceBank(sourceBank) : null;
  const payload = buildZanacoPayload(payment, payment.transactionType, src || undefined);
  return postToQueue(payload);
}
