import { JobScheduler, Queue, Worker } from 'bullmq';
import { createHash } from 'node:crypto';
import type { PaymentWork } from './paymentProcessor';
import type { ZanacoPreparedRequest } from './types';
import { reportPaymentResult } from './portalQueueClient';

const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
};

export const ZANACO_QUEUE_NAME = process.env.ZANACO_QUEUE_NAME || 'zanaco-payments';

export const paymentQueue = new Queue<PaymentWork>(ZANACO_QUEUE_NAME, { connection });
export const queueScheduler = new JobScheduler(ZANACO_QUEUE_NAME, { connection });

export async function markSubmissionStarted(queueId: string) {
  const client = await paymentQueue.client;
  const key = `${ZANACO_QUEUE_NAME}:submission:${createHash('sha256').update(queueId).digest('hex')}`;
  client.defineCommand('beginZanacoSubmission', {
    numberOfKeys: 1,
    lua: "if redis.call('EXISTS', KEYS[1]) == 1 then return 0; end; redis.call('SET', KEYS[1], ARGV[1]); return 1;",
  });
  return await client.runCommand('beginZanacoSubmission', [key, Date.now().toString()]) === 1;
}

export async function reserveBankReferences(prepared: ZanacoPreparedRequest, owner: string) {
  const request = prepared.request ?? {};
  const refs = Array.isArray(request.items)
    ? request.items.map((item: any) => String(item.externalTranRef ?? ''))
    : [prepared.externalTranRef ?? ''];
  const client = await paymentQueue.client;
  client.defineCommand('reserveZanacoReference', {
    numberOfKeys: 1,
    lua: "local owner = redis.call('GET', KEYS[1]); if not owner then redis.call('SET', KEYS[1], ARGV[1]); return ARGV[1]; end; return owner;",
  });
  for (const ref of refs.filter(Boolean)) {
    const key = `${ZANACO_QUEUE_NAME}:reference:${createHash('sha256').update(ref).digest('hex')}`;
    // Reference reservations deliberately have no TTL: completion cannot make a
    // bank transaction identity available to a different payment.
    if (await client.runCommand('reserveZanacoReference', [key, owner]) !== owner) {
      throw new Error('Bank reference is already reserved for another payment; manual reconciliation required');
    }
  }
}

export async function enqueuePaymentWork(payment: unknown, queueId: string, sourceBank?: string | null, reportToPortal = false) {
  // The same portal instruction must never create a second local submission job.
  const jobId = createHash('sha256').update(queueId).digest('hex');
  const data: PaymentWork = { payment, queueId, sourceBank, reportToPortal };
  await paymentQueue.add('send-zanaco-payment', data, {
    jobId,
    attempts: Number(process.env.JOB_ATTEMPTS || 10),
    backoff: { type: 'exponential', delay: Number(process.env.JOB_BACKOFF_MS || 60000) },
    removeOnComplete: false,
    removeOnFail: false,
  });
  const job = await paymentQueue.getJob(jobId);
  if (!job) throw new Error('Unable to read durable Zanaco payment job');
  if (JSON.stringify(job.data.payment) !== JSON.stringify(payment)) {
    throw new Error('Queue identity already belongs to a different payment payload');
  }
  const state = await job.getState();
  if (reportToPortal && (state === 'completed' || state === 'failed')) {
    // A portal redelivery of a retained job must replay its result, not leave the
    // portal processing forever or create a second bank submission.
    await reportPaymentResult(queueId, job.data.checkpoint?.result ?? {
      success: false, status: 409, unknown: true,
      error: 'Retained legacy job requires manual reconciliation of its original bank reference',
    }, job.attemptsMade);
  }
  return job;
}

export function buildWorker(processor: (job: any) => Promise<any>) {
  return new Worker(ZANACO_QUEUE_NAME, async (job) => processor(job), { connection, concurrency: Number(process.env.ZANACO_WORKER_CONCURRENCY || 3) });
}
