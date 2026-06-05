import { Queue, Worker, JobScheduler } from 'bullmq';
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || '';
let connection: any;
if (redisUrl) {
  connection = new IORedis(redisUrl);
} else {
  connection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  };
}

export const PAYMENT_QUEUE = process.env.IZB_QUEUE_NAME || 'izb_payments';

export const paymentQueue = new Queue(PAYMENT_QUEUE, { connection });
let queueScheduler: any;
try {
  queueScheduler = new JobScheduler(PAYMENT_QUEUE, { connection });
} catch (err) {
  // Fall back to a minimal no-op scheduler to avoid startup failure if JobScheduler is unavailable
  queueScheduler = { on: (_: string, __: (...args: any[]) => void) => { /* no-op */ } };
}

export function buildWorker(processor: (job: any) => Promise<any>) {
  return new Worker(PAYMENT_QUEUE, async (job) => processor(job), { connection, concurrency: 5 });
}

export default { paymentQueue, buildWorker, queueScheduler };
