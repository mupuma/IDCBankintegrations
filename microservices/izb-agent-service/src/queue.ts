import { Queue, Worker, QueueScheduler } from 'bullmq';
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const connection = new IORedis(redisUrl);

export const PAYMENT_QUEUE = process.env.IZB_QUEUE_NAME || 'izb_payments';

export const paymentQueue = new Queue(PAYMENT_QUEUE, { connection });
export const queueScheduler = new QueueScheduler(PAYMENT_QUEUE, { connection });

export function buildWorker(processor: (job:any)=>Promise<any>) {
  const worker = new Worker(PAYMENT_QUEUE, async (job) => processor(job), { connection });
  return worker;
}

export default { paymentQueue, buildWorker, queueScheduler };
import { JobScheduler, Queue, Worker } from 'bullmq';

const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
};

export const IZB_QUEUE_NAME = process.env.IZB_QUEUE_NAME || 'izb-payments';

export const paymentQueue = new Queue<unknown>(IZB_QUEUE_NAME, { connection });
export const queueScheduler = new JobScheduler(IZB_QUEUE_NAME, { connection });

export function buildWorker(processor: (job: any) => Promise<any>) {
  return new Worker(IZB_QUEUE_NAME, async (job) => processor(job), { connection, concurrency: 5 });
}
