"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueScheduler = exports.paymentQueue = exports.ZICB_QUEUE_NAME = void 0;
exports.buildWorker = buildWorker;
const bullmq_1 = require("bullmq");
const connection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
};
exports.ZICB_QUEUE_NAME = process.env.ZICB_QUEUE_NAME || 'zicb-payments';
exports.paymentQueue = new bullmq_1.Queue(exports.ZICB_QUEUE_NAME, { connection });
exports.queueScheduler = new bullmq_1.JobScheduler(exports.ZICB_QUEUE_NAME, { connection });
function buildWorker(processor) {
    return new bullmq_1.Worker(exports.ZICB_QUEUE_NAME, async (job) => processor(job), { connection, concurrency: 5 });
}
