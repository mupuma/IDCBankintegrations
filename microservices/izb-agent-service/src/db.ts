import { LowSync } from 'lowdb';
import { JSONFileSync } from 'lowdb/node';

const DB_PATH = process.env.DB_PATH || './izb-agent-db.json';

export interface QueueRequestRecord {
  queueId: string;
  bankCode: string;
  payload: unknown;
  status: string;
  attempts: number;
  lastError?: string;
  responsePayload?: unknown;
  createdAt: string;
  updatedAt: string;
}

type LowDbSchema = {
  payment_queue_requests: QueueRequestRecord[];
};

const adapter = new JSONFileSync<LowDbSchema>(DB_PATH);
const db = new LowSync<LowDbSchema>(adapter, { payment_queue_requests: [] });

db.read();
if (!db.data) {
  db.data = { payment_queue_requests: [] };
  db.write();
}

export function initDatabase() {
  if (!db.data) {
    db.data = { payment_queue_requests: [] };
    db.write();
  }
}

export function insertQueueRequest(request: QueueRequestRecord) {
  db.read();
  db.data = db.data ?? { payment_queue_requests: [] };
  const existingIndex = db.data.payment_queue_requests.findIndex((item) => item.queueId === request.queueId);

  if (existingIndex >= 0) {
    db.data.payment_queue_requests[existingIndex] = request;
  } else {
    db.data.payment_queue_requests.push(request);
  }

  db.write();
}

export function updateQueueRequestStatus(
  queueId: string,
  updates: {
    status?: string;
    attempts?: number;
    lastError?: string;
    response?: unknown;
    updatedAt?: string;
  },
) {
  db.read();
  db.data = db.data ?? { payment_queue_requests: [] };
  const existing = db.data.payment_queue_requests.find((item) => item.queueId === queueId);
  if (!existing) {
    return null;
  }

  existing.status = updates.status ?? existing.status;
  existing.attempts = updates.attempts ?? existing.attempts;
  existing.lastError = updates.lastError ?? existing.lastError;
  if (updates.response !== undefined) {
    existing.responsePayload = updates.response as unknown;
  }
  existing.updatedAt = updates.updatedAt ?? new Date().toISOString();
  db.write();

  return existing;
}

export function findQueueRequest(queueId: string) {
  db.read();
  db.data = db.data ?? { payment_queue_requests: [] };
  const existing = db.data.payment_queue_requests.find((item) => item.queueId === queueId);
  return existing ?? null;
}

export default { initDatabase, insertQueueRequest, updateQueueRequestStatus, findQueueRequest };
