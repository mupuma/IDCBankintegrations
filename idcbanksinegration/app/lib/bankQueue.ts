import type { BankCode, PaymentsResponse } from '@/app/models/dtos';
import { sendPaymentToBank } from './banks';
import { connectDatabase } from './db';
import { PaymentQueueRequest } from '@/app/models/internal/PaymentQueueRequest';
import { terminalLog, terminalError } from '@/app/lib/terminalLog';

export type QueueStatus = 'queued' | 'processing' | 'success' | 'failed' | 'submitting' | 'accepted' | 'unknown' | 'paid' | 'rejected' | 'needs_review';

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
const AGENT_CALLBACK_TIMEOUT_MS = Number(process.env.AGENT_CALLBACK_TIMEOUT_MS || 120000);

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
  terminalLog('queue.enqueued.memory', {
    queueId: id,
    paymentId: item.paymentId,
    bankCode,
    sourceBank,
    service: (payment as any).service,
    transactionType: (payment as any).transactionType ?? (payment as any).meta?.transactionType,
  });
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
    terminalLog('queue.process.skipped_already_processing', { queueId });
    return item;
  }

  processing.add(queueId);
  item.attempts += 1;
  item.status = 'processing';
  item.updatedAt = new Date().toISOString();
  queue.set(queueId, item);

  await persistQueueRecord(item);
  terminalLog('queue.process.started', {
    queueId,
    paymentId: item.paymentId,
    bankCode: item.bankCode,
    attempts: item.attempts,
  });

  try {
    const result = await sendPaymentToBank(item.bankCode, item.payment, queueId, item.sourceBank ?? null);
    item.response = result.data;
    terminalLog('queue.process.bank_result', {
      queueId,
      paymentId: item.paymentId,
      bankCode: item.bankCode,
      success: result.success,
      status: result.status,
      deferred: result.deferred,
      error: result.error,
    });

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
    item.lastError = error instanceof Error ? error.message : String(error);
    item.status = item.attempts < MAX_RETRIES ? 'queued' : 'failed';
    terminalError('queue.process.exception', {
      queueId,
      paymentId: item.paymentId,
      bankCode: item.bankCode,
      attempts: item.attempts,
      error: item.lastError,
    });
  }

  item.updatedAt = new Date().toISOString();
  queue.set(queueId, item);
  processing.delete(queueId);

  await persistQueueRecord(item);
  terminalLog('queue.process.persisted', {
    queueId,
    paymentId: item.paymentId,
    bankCode: item.bankCode,
    status: item.status,
    attempts: item.attempts,
    lastError: item.lastError,
  });

  if (item.status === 'queued' && item.attempts < MAX_RETRIES) {
    setTimeout(() => {
      terminalLog('queue.retry.triggered', { queueId, attempts: item.attempts + 1 });
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
    terminalError('queue.persist.failed', {
      queueId: item.id,
      paymentId: item.paymentId,
      bankCode: item.bankCode,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function ensureQueueItemProcessing(queueId: string) {
  const item = queue.get(queueId);
  if (!item) {
    return null;
  }

  if ((item.payment as any).h2hProtocol === 'h2h-v1') return item;

  if (item.status === 'queued' && !processing.has(queueId)) {
    terminalLog('queue.ensure_processing', { queueId, bankCode: item.bankCode, status: item.status });
    return processQueueItem(queueId);
  }

  return item;
}

export async function rehydrateAndProcessQueueRecord(record: PaymentQueueRequest) {
  let payment: PaymentsResponse;
  try {
    payment = JSON.parse(record.paymentPayload) as PaymentsResponse;
  } catch {
    await PaymentQueueRequest.update(
      {
        status: 'failed',
        lastError: 'Invalid saved payment payload; cannot process queue item.',
      },
      { where: { queueId: record.queueId } },
    );
    return null;
  }

  const item = enqueuePayment(
    record.bankCode as BankCode,
    payment,
    record.queueId,
    record.sourceBank ?? null,
  );
  item.attempts = record.attempts;
  item.status = 'queued';
  item.createdAt = record.createdAt.toISOString();
  item.updatedAt = new Date().toISOString();

  return processQueueItem(record.queueId);
}

export function isStaleProcessingRecord(record: PaymentQueueRequest) {
  if (record.status !== 'processing') {
    return false;
  }

  const updatedAt = record.updatedAt instanceof Date
    ? record.updatedAt.getTime()
    : new Date(record.updatedAt).getTime();

  return Number.isFinite(updatedAt) && Date.now() - updatedAt > AGENT_CALLBACK_TIMEOUT_MS;
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
