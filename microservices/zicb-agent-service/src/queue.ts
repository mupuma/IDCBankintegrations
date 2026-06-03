import { JobScheduler, Queue, Worker } from 'bullmq';

const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
};

export const ZICB_QUEUE_NAME = process.env.ZICB_QUEUE_NAME || 'zicb-payments';

export const paymentQueue = new Queue<unknown>(ZICB_QUEUE_NAME, { connection });
export const queueScheduler = new JobScheduler(ZICB_QUEUE_NAME, { connection });

export function buildWorker(processor: (job: any) => Promise<any>) {
  return new Worker(ZICB_QUEUE_NAME, async (job) => processor(job), { connection, concurrency: 5 });
}
