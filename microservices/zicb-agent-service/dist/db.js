"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
exports.insertQueueRequest = insertQueueRequest;
exports.updateQueueRequestStatus = updateQueueRequestStatus;
exports.getQueueRequest = getQueueRequest;
const lowdb_1 = require("lowdb");
const node_1 = require("lowdb/node");
const DB_PATH = process.env.DB_PATH || './zicb-agent-db.json';
const adapter = new node_1.JSONFileSync(DB_PATH);
const db = new lowdb_1.LowSync(adapter, { payment_queue_requests: [] });
db.read();
if (!db.data) {
    db.data = { payment_queue_requests: [] };
    db.write();
}
function initDatabase() {
    if (!db.data) {
        db.data = { payment_queue_requests: [] };
    }
}
function insertQueueRequest(request) {
    db.read();
    db.data = db.data ?? { payment_queue_requests: [] };
    const existingIndex = db.data.payment_queue_requests.findIndex((item) => item.queueId === request.queueId);
    if (existingIndex >= 0) {
        db.data.payment_queue_requests[existingIndex] = request;
    }
    else {
        db.data.payment_queue_requests.push(request);
    }
    db.write();
}
function updateQueueRequestStatus(queueId, updates) {
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
function getQueueRequest(queueId) {
    db.read();
    db.data = db.data ?? { payment_queue_requests: [] };
    const existing = db.data.payment_queue_requests.find((item) => item.queueId === queueId);
    return existing ?? null;
}
