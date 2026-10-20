"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueScheduler = exports.paymentQueue = exports.ZANACO_QUEUE_NAME = void 0;
exports.markSubmissionStarted = markSubmissionStarted;
exports.reserveBankReferences = reserveBankReferences;
exports.enqueuePaymentWork = enqueuePaymentWork;
exports.buildWorker = buildWorker;
const bullmq_1 = require("bullmq");
const node_crypto_1 = require("node:crypto");
const portalQueueClient_1 = require("./portalQueueClient");
const connection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
};
exports.ZANACO_QUEUE_NAME = process.env.ZANACO_QUEUE_NAME || 'zanaco-payments';
exports.paymentQueue = new bullmq_1.Queue(exports.ZANACO_QUEUE_NAME, { connection });
exports.queueScheduler = new bullmq_1.JobScheduler(exports.ZANACO_QUEUE_NAME, { connection });
async function markSubmissionStarted(queueId) {
    const client = await exports.paymentQueue.client;
    const key = `${exports.ZANACO_QUEUE_NAME}:submission:${(0, node_crypto_1.createHash)('sha256').update(queueId).digest('hex')}`;
    client.defineCommand('beginZanacoSubmission', {
        numberOfKeys: 1,
        lua: "if redis.call('EXISTS', KEYS[1]) == 1 then return 0; end; redis.call('SET', KEYS[1], ARGV[1]); return 1;",
    });
    return await client.runCommand('beginZanacoSubmission', [key, Date.now().toString()]) === 1;
}
async function reserveBankReferences(prepared, owner) {
    const request = prepared.request ?? {};
    const refs = Array.isArray(request.items)
        ? request.items.map((item) => String(item.externalTranRef ?? ''))
        : [prepared.externalTranRef ?? ''];
    const client = await exports.paymentQueue.client;
    client.defineCommand('reserveZanacoReference', {
        numberOfKeys: 1,
        lua: "local owner = redis.call('GET', KEYS[1]); if not owner then redis.call('SET', KEYS[1], ARGV[1]); return ARGV[1]; end; return owner;",
    });
    for (const ref of refs.filter(Boolean)) {
        const key = `${exports.ZANACO_QUEUE_NAME}:reference:${(0, node_crypto_1.createHash)('sha256').update(ref).digest('hex')}`;
        // Reference reservations deliberately have no TTL: completion cannot make a
        // bank transaction identity available to a different payment.
        if (await client.runCommand('reserveZanacoReference', [key, owner]) !== owner) {
            throw new Error('Bank reference is already reserved for another payment; manual reconciliation required');
        }
    }
}
async function enqueuePaymentWork(payment, queueId, sourceBank, reportToPortal = false) {
    // The same portal instruction must never create a second local submission job.
    const jobId = (0, node_crypto_1.createHash)('sha256').update(queueId).digest('hex');
    const data = { payment, queueId, sourceBank, reportToPortal };
    await exports.paymentQueue.add('send-zanaco-payment', data, {
        jobId,
        attempts: Number(process.env.JOB_ATTEMPTS || 10),
        backoff: { type: 'exponential', delay: Number(process.env.JOB_BACKOFF_MS || 60000) },
        removeOnComplete: false,
        removeOnFail: false,
    });
    const job = await exports.paymentQueue.getJob(jobId);
    if (!job)
        throw new Error('Unable to read durable Zanaco payment job');
    if (JSON.stringify(job.data.payment) !== JSON.stringify(payment)) {
        throw new Error('Queue identity already belongs to a different payment payload');
    }
    const state = await job.getState();
    if (reportToPortal && (state === 'completed' || state === 'failed')) {
        // A portal redelivery of a retained job must replay its result, not leave the
        // portal processing forever or create a second bank submission.
        await (0, portalQueueClient_1.reportPaymentResult)(queueId, job.data.checkpoint?.result ?? {
            success: false, status: 409, unknown: true,
            error: 'Retained legacy job requires manual reconciliation of its original bank reference',
        }, job.attemptsMade);
    }
    return job;
}
function buildWorker(processor) {
    return new bullmq_1.Worker(exports.ZANACO_QUEUE_NAME, async (job) => processor(job), { connection, concurrency: Number(process.env.ZANACO_WORKER_CONCURRENCY || 3) });
}
