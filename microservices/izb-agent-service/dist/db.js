"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
exports.insertQueueRequest = insertQueueRequest;
exports.updateQueueRequestStatus = updateQueueRequestStatus;
exports.findQueueRequest = findQueueRequest;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DB_PATH = process.env.DB_PATH || './izb-agent-db.json';
function defaultData() {
    return { payment_queue_requests: [] };
}
function ensureFile() {
    const directory = path_1.default.dirname(DB_PATH);
    if (directory && directory !== '.') {
        fs_1.default.mkdirSync(directory, { recursive: true });
    }
    if (!fs_1.default.existsSync(DB_PATH)) {
        fs_1.default.writeFileSync(DB_PATH, JSON.stringify(defaultData(), null, 2));
    }
}
function readData() {
    ensureFile();
    const text = fs_1.default.readFileSync(DB_PATH, 'utf8');
    if (!text.trim()) {
        return defaultData();
    }
    try {
        const parsed = JSON.parse(text);
        return {
            payment_queue_requests: Array.isArray(parsed.payment_queue_requests)
                ? parsed.payment_queue_requests
                : [],
        };
    }
    catch {
        return defaultData();
    }
}
function writeData(data) {
    ensureFile();
    fs_1.default.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}
function initDatabase() {
    ensureFile();
}
function insertQueueRequest(request) {
    const data = readData();
    const existingIndex = data.payment_queue_requests.findIndex((item) => item.queueId === request.queueId);
    if (existingIndex >= 0) {
        data.payment_queue_requests[existingIndex] = request;
    }
    else {
        data.payment_queue_requests.push(request);
    }
    writeData(data);
}
function updateQueueRequestStatus(queueId, updates) {
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
function findQueueRequest(queueId) {
    const data = readData();
    return data.payment_queue_requests.find((item) => item.queueId === queueId) ?? null;
}
exports.default = { initDatabase, insertQueueRequest, updateQueueRequestStatus, findQueueRequest };
