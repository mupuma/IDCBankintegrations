import fs from 'fs';
import path from 'path';

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

function defaultData(): LowDbSchema {
  return { payment_queue_requests: [] };
}

function ensureFile() {
  const directory = path.dirname(DB_PATH);
  if (directory && directory !== '.') {
    fs.mkdirSync(directory, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultData(), null, 2));
  }
}

function readData(): LowDbSchema {
  ensureFile();
  const text = fs.readFileSync(DB_PATH, 'utf8');
  if (!text.trim()) {
    return defaultData();
  }

  try {
    const parsed = JSON.parse(text) as Partial<LowDbSchema>;
    return {
      payment_queue_requests: Array.isArray(parsed.payment_queue_requests)
        ? parsed.payment_queue_requests
        : [],
    };
  } catch {
    return defaultData();
  }
}

function writeData(data: LowDbSchema) {
  ensureFile();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

export function initDatabase() {
  ensureFile();
}

export function insertQueueRequest(request: QueueRequestRecord) {
  const data = readData();
  const existingIndex = data.payment_queue_requests.findIndex((item) => item.queueId === request.queueId);

  if (existingIndex >= 0) {
    data.payment_queue_requests[existingIndex] = request;
  } else {
    data.payment_queue_requests.push(request);
  }

  writeData(data);
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
  const data = readData();
  const existing = data.payment_queue_requests.find((item) => item.queueId === queueId);
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
  writeData(data);

  return existing;
}

export function findQueueRequest(queueId: string) {
  const data = readData();
  return data.payment_queue_requests.find((item) => item.queueId === queueId) ?? null;
}

export default { initDatabase, insertQueueRequest, updateQueueRequestStatus, findQueueRequest };
