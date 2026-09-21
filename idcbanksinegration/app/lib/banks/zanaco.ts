import type { PaymentsResponse } from '../../models/dtos';
import { buildZanacoPayload } from './payloadBuilders';
import { resolveSourceBank } from '@/app/lib/sourceAccounts';
import { terminalLog, terminalError } from '@/app/lib/terminalLog';

const QUEUE_URL = process.env.ZANACO_BANK_API_URL;

async function postToQueue(payload: unknown) {
  if (!QUEUE_URL) {
    terminalError('zanaco.dispatch.config_missing', { config: 'ZANACO_BANK_API_URL' });
    throw new Error('Missing ZANACO_BANK_API_URL environment variable');
  }

  const payloadRecord = payload && typeof payload === 'object' ? payload as Record<string, any> : {};
  terminalLog('zanaco.dispatch.request', {
    queueId: payloadRecord.queueId,
    service: payloadRecord.service,
    sourceBank: payloadRecord.sourceBank,
    endpoint: QUEUE_URL,
  });

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

  const validationErrors = data && typeof data === 'object' && Array.isArray((data as { validationErrors?: unknown }).validationErrors)
    ? (data as { validationErrors: unknown[] }).validationErrors.map((error) => String(error))
    : [];
  const responseError = data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
    ? String((data as { error: string }).error)
    : undefined;
  const error = response.ok
    ? undefined
    : [responseError || `Zanaco queue request failed with status ${response.status}`, ...validationErrors].join(': ');

  if (response.ok) {
    terminalLog('zanaco.dispatch.response', {
      queueId: payloadRecord.queueId,
      service: payloadRecord.service,
      status: response.status,
      deferred: response.status === 202,
    });
  } else {
    terminalError('zanaco.dispatch.response_error', {
      queueId: payloadRecord.queueId,
      service: payloadRecord.service,
      status: response.status,
      error,
    });
  }

  return {
    success: response.ok,
    status: response.status,
    data,
    deferred: response.status === 202,
    error,
  };
}

export function createZanacoPayload(payment: PaymentsResponse, sourceBank?: { accountNumber?: string | null; transit?: string | null; name?: string | null }) {
  return buildZanacoPayload(payment, payment.transactionType, sourceBank);
}

export async function sendZanacoPayment(payment: PaymentsResponse, queueId?: string, sourceBank?: string | null) {
  if (payment && typeof payment === 'object' && 'service' in payment && 'request' in payment) {
    return postToQueue({ ...(payment as unknown as Record<string, unknown>), queueId, sourceBank });
  }

  const src = sourceBank ? await resolveSourceBank(sourceBank) : null;
  const payload = buildZanacoPayload(payment, payment.transactionType, src || undefined);
  terminalLog('zanaco.payload.built', {
    queueId,
    paymentId: payment.paymentId,
    transactionReference: payment.transactionReference,
    transactionType: payment.transactionType,
    service: payload.service,
    debitAccount: payload.request.debitAccount,
    creditAccount: payload.request.creditAccount,
    valueDate: payload.request.valueDate,
  });
  return postToQueue({ ...payload, queueId, sourceBank });
}
