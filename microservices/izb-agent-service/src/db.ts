import { Low, JSONFile } from 'lowdb';
import { join } from 'path';

type QueueRecord = {
  queueId: string;
  bankCode: string;
  payload: any;
  status: 'queued'|'processing'|'success'|'failed'|'queued';
  attempts: number;
  lastError?: string;
  response?: any;
  createdAt: string;
  updatedAt: string;
};

type DB = { queue: QueueRecord[] };

let db: Low<DB>;

export async function initDatabase() {
  const file = join(process.cwd(), 'izb-db.json');
  const adapter = new JSONFile<DB>(file);
  db = new Low<DB>(adapter);
  await db.read();
  db.data ||= { queue: [] };
  await db.write();
}

export function insertQueueRequest(rec: QueueRecord) {
  db.data!.queue.push(rec);
  return db.write();
}

export function updateQueueRequestStatus(queueId: string, patch: Partial<QueueRecord>) {
  const idx = db.data!.queue.findIndex(q => q.queueId === queueId);
  if (idx === -1) return;
  db.data!.queue[idx] = { ...db.data!.queue[idx], ...patch } as QueueRecord;
  return db.write();
}

export function findQueueRequest(queueId: string) {
  return db.data!.queue.find(q => q.queueId === queueId);
}

export default { initDatabase, insertQueueRequest, updateQueueRequestStatus, findQueueRequest };
import { LowSync } from 'lowdb';
import { JSONFileSync } from 'lowdb/node';

const DB_PATH = process.env.DB_PATH || './izb-agent-db.json';

type LowDbSchema = {
  payment_queue_requests: QueueRequestRecord[];
};

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
    existing.responsePayload = updates.response;
  }
  existing.updatedAt = updates.updatedAt ?? new Date().toISOString();
  db.write();

  return existing;
}

export function getQueueRequest(queueId: string) {
  db.read();
  db.data = db.data ?? { payment_queue_requests: [] };
  const existing = db.data.payment_queue_requests.find((item) => item.queueId === queueId);
  return existing ?? null;
}
