import type { BankCode, PaymentsResponse } from '@/app/models/dtos';
import { sendPaymentToBank } from './banks';
import { connectDatabase } from './db';
import { PaymentQueueRequest } from '@/app/models/internal/PaymentQueueRequest';

export type QueueStatus = 'queued' | 'processing' | 'success' | 'failed';

export interface BankQueueItem {
  id: string;
  paymentId: string;
  bankCode: BankCode;
  payment: PaymentsResponse;
  sourceBank?: string | null;
  status: QueueStatus;
  attempts: number;
  lastError?: string;
  response?: unknown;
  createdAt: string;
  updatedAt: string;
}

const queue = new Map<string, BankQueueItem>();
const processing = new Set<string>();
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

export function enqueuePayment(bankCode: BankCode, payment: PaymentsResponse, queueId?: string, sourceBank?: string | null) {
  const id = queueId ?? (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  const item: BankQueueItem = {
    id,
    paymentId: (payment as any).paymentId || id,
    bankCode,
    sourceBank: sourceBank ?? null,
    payment,
    status: 'queued',
    attempts: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  queue.set(id, item);
  return item;
}

export function getQueueItem(queueId: string) {
  return queue.get(queueId) ?? null;
}

export function getAllQueueItems() {
  return Array.from(queue.values());
}

export function getQueueItemsByBank(bankCode: BankCode) {
  return getAllQueueItems().filter((item) => item.bankCode === bankCode);
}

export function isQueueProcessing(queueId: string) {
  return processing.has(queueId);
}

export async function processQueueItem(queueId: string) {
  const item = queue.get(queueId);
  if (!item) {
    return null;
  }

  if (processing.has(queueId)) {
    return item;
  }

  processing.add(queueId);
  item.attempts += 1;
  item.status = 'processing';
  item.updatedAt = new Date().toISOString();
  queue.set(queueId, item);

  await persistQueueRecord(item);

  try {
    const result = await sendPaymentToBank(item.bankCode, item.payment, queueId, item.sourceBank ?? null);
    item.response = result.data;

    if (result.deferred) {
      item.status = 'processing';
      item.lastError = undefined;
    } else if (result.success) {
      item.status = 'success';
      item.lastError = undefined;
    } else {
      item.lastError = result.error ?? `Queue post failed (${result.status})`;
      item.status = item.attempts < MAX_RETRIES ? 'queued' : 'failed';
    }
  } catch (error: any) {
    item.lastError = String(error);
    item.status = item.attempts < MAX_RETRIES ? 'queued' : 'failed';
  }

  item.updatedAt = new Date().toISOString();
  queue.set(queueId, item);
  processing.delete(queueId);

  await persistQueueRecord(item);

  if (item.status === 'queued' && item.attempts < MAX_RETRIES) {
    setTimeout(() => {
      void processQueueItem(queueId);
    }, RETRY_DELAY_MS);
  }

  return item;
}

async function persistQueueRecord(item: BankQueueItem) {
  try {
    await connectDatabase();
    await PaymentQueueRequest.update(
      {
        status: item.status,
        attempts: item.attempts,
        lastError: item.lastError ?? undefined,
        responsePayload: item.response ? JSON.stringify(item.response) : undefined,
        updatedAt: item.updatedAt,
      },
      {
        where: { queueId: item.id },
      },
    );
  } catch (error) {
    console.error('Failed to persist queue request status', error);
  }
}

export async function ensureQueueItemProcessing(queueId: string) {
  const item = queue.get(queueId);
  if (!item) {
    return null;
  }

  if (item.status === 'queued' && !processing.has(queueId)) {
    void processQueueItem(queueId);
  }

  return item;
}

export async function updateQueueItemStatus(
  queueId: string,
  updates: {
    status?: QueueStatus;
    response?: unknown;
    lastError?: string;
    attempts?: number;
  },
) {
  const item = queue.get(queueId);
  const updatedAt = new Date().toISOString();

  if (item) {
    if (updates.status) {
      item.status = updates.status;
    }
    if (updates.response !== undefined) {
      item.response = updates.response;
    }
    if (updates.lastError !== undefined) {
      item.lastError = updates.lastError;
    }
    if (updates.attempts !== undefined) {
      item.attempts = updates.attempts;
    }
    item.updatedAt = updatedAt;
    queue.set(queueId, item);
  }

  try {
    await connectDatabase();
    await PaymentQueueRequest.update(
      {
        status: updates.status ?? item?.status,
        attempts: updates.attempts ?? item?.attempts,
        lastError: updates.lastError ?? item?.lastError ?? undefined,
        responsePayload: updates.response !== undefined ? JSON.stringify(updates.response) : item?.response ? JSON.stringify(item.response) : undefined,
        updatedAt,
      },
      { where: { queueId } },
    );
  } catch (error) {
    console.error('Failed to persist queue callback response', error);
  }

  return item ?? null;
}
