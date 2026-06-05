import dotenv from 'dotenv';
import { buildWorker, queueScheduler } from './queue';
import { notifyAppOfQueueResult, sendIzbPayment } from './izbAgent';
import { initDatabase, updateQueueRequestStatus } from './db';
import type { JobResult } from './types';

dotenv.config();
initDatabase();

const worker = buildWorker(async (job) => {
  const payload = job.data as { payment: unknown; queueId?: string };
  if (!payload?.payment) {
    throw new Error('Job missing payment payload');
  }

  const queueId = payload.queueId;
  const attempts = job.attemptsMade + 1;
  const hasMoreRetries = typeof job.opts.attempts === 'number'
    ? job.attemptsMade < job.opts.attempts - 1
    : false;

  if (queueId) {
    updateQueueRequestStatus(queueId, {
      status: 'processing',
      attempts,
      lastError: undefined,
      updatedAt: new Date().toISOString(),
    });
  }

  try {
    const result = await sendIzbPayment(payload.payment as any);

    // NOTE: cashbook posting is handled by the bank posting receipts back to the portal.

    if (queueId) {
      updateQueueRequestStatus(queueId, {
        status: result.success ? 'success' : (hasMoreRetries ? 'queued' : 'failed'),
        attempts,
        lastError: result.error,
        response: result.data,
        updatedAt: new Date().toISOString(),
      });
    }

    if (payload.queueId) {
      await notifyAppOfQueueResult(payload.queueId, result);
    }

    if (!result.success) {
      throw new Error(result.error || `IZB send failed with status ${result.status}`);
    }

    return result;
  } catch (error: any) {
    if (queueId) {
      updateQueueRequestStatus(queueId, {
        status: hasMoreRetries ? 'queued' : 'failed',
        attempts,
        lastError: String(error),
        updatedAt: new Date().toISOString(),
      });
    }
    if (payload.queueId) {
      await notifyAppOfQueueResult(payload.queueId, {
        success: false,
        status: error?.status ?? 500,
        error: String(error),
      });
    }
    throw error;
  }
});

worker.on('completed', (job:any, returnvalue:any) => {
  console.log(`IZB job completed: ${job.id}`, returnvalue);
});

worker.on('failed', (job:any, err:any) => {
  console.error(`IZB job failed: ${job.id}`, err.message);
});

queueScheduler.on('error', (error:any) => {
  console.error('Queue scheduler error:', error);
});

worker.on('error', (error:any) => {
  console.error('Worker error:', error);
});

console.log('IZB worker started, listening for payments...');
