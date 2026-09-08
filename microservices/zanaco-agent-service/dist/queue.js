"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueScheduler = exports.paymentQueue = exports.ZANACO_QUEUE_NAME = void 0;
exports.buildWorker = buildWorker;
const bullmq_1 = require("bullmq");
const connection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
};
exports.ZANACO_QUEUE_NAME = process.env.ZANACO_QUEUE_NAME || 'zanaco-payments';
exports.paymentQueue = new bullmq_1.Queue(exports.ZANACO_QUEUE_NAME, { connection });
exports.queueScheduler = new bullmq_1.JobScheduler(exports.ZANACO_QUEUE_NAME, { connection });
function buildWorker(processor) {
    return new bullmq_1.Worker(exports.ZANACO_QUEUE_NAME, async (job) => processor(job), { connection, concurrency: Number(process.env.ZANACO_WORKER_CONCURRENCY || 3) });
}
