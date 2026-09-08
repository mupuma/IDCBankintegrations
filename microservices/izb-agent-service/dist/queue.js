"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueScheduler = exports.paymentQueue = exports.PAYMENT_QUEUE = void 0;
exports.buildWorker = buildWorker;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const redisUrl = process.env.REDIS_URL || '';
let connection;
if (redisUrl) {
    connection = new ioredis_1.default(redisUrl);
}
else {
    connection = {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: Number(process.env.REDIS_PORT || 6379),
        password: process.env.REDIS_PASSWORD || undefined,
    };
}
exports.PAYMENT_QUEUE = process.env.IZB_QUEUE_NAME || 'izb_payments';
exports.paymentQueue = new bullmq_1.Queue(exports.PAYMENT_QUEUE, { connection });
try {
    exports.queueScheduler = new bullmq_1.JobScheduler(exports.PAYMENT_QUEUE, { connection });
}
catch (err) {
    // Fall back to a minimal no-op scheduler to avoid startup failure if JobScheduler is unavailable
    exports.queueScheduler = { on: (_, __) => { } };
}
function buildWorker(processor) {
    return new bullmq_1.Worker(exports.PAYMENT_QUEUE, async (job) => processor(job), { connection, concurrency: 5 });
}
exports.default = { paymentQueue: exports.paymentQueue, buildWorker, queueScheduler: exports.queueScheduler };
