import 'dotenv/config';
import { buildWorker, paymentQueue, queueScheduler } from './queue';
import { isZanacoServicePayload } from './zanacoValidation';
import { prepareZanacoPayload, prepareZanacoServicePayload, sendZanacoPayment } from './zanacoAgent';
import { claimNextPayment, emitAgentAudit, reportPaymentProcessing, reportPaymentResult } from './portalQueueClient';
import { isBulkService, prepareBulkPayload, submitBulk } from './bulk';

const worker = buildWorker(async (job) => {
  const payload = job.data as { payment: unknown; queueId?: string; sourceBank?: string | null };
  if (!payload?.payment) throw new Error('Job missing payment payload');

  const queueId = payload.queueId;
  const attempts = job.attemptsMade + 1;
  const hasMoreRetries = typeof job.opts.attempts === 'number'
    ? job.attemptsMade < job.opts.attempts - 1
    : false;

  if (queueId) await reportPaymentProcessing(queueId, attempts);

  const correlationId = queueId || (payload.payment as any)?.paymentId || (payload.payment as any)?.transactionReference;
  const paymentId = (payload.payment as any)?.paymentId || (payload.payment as any)?.transactionReference || correlationId;

  await emitAgentAudit({
    action: 'AGENT_SEND_STARTED',
    correlationId,
    resourceId: paymentId,
    summary: `Zanaco agent started payment ${paymentId ?? 'unknown'}`,
    details: { queueId, attempts },
  });

  try {
    let result;
    if (isZanacoServicePayload(payload.payment)) {
      if (isBulkService(payload.payment.service)) {
        result = await submitBulk(prepareBulkPayload(payload.payment.service, payload.payment.request));
      } else {
        result = await sendZanacoPayment(prepareZanacoServicePayload(payload.payment));
      }
    } else {
      result = await sendZanacoPayment(prepareZanacoPayload(payload.payment as any));
    }

    if (queueId) {
      if (result.success || !hasMoreRetries || !result.retryable) {
        await reportPaymentResult(queueId, result, attempts);
      } else {
        await reportPaymentProcessing(queueId, attempts, result.error);
      }
    }

    await emitAgentAudit({
      action: result.success ? 'AGENT_SEND_SUCCEEDED' : result.unknown ? 'AGENT_SEND_UNKNOWN' : 'AGENT_SEND_FAILED',
      correlationId,
      resourceId: paymentId,
      summary: result.success ? `Zanaco agent completed payment ${paymentId ?? 'unknown'}` : `Zanaco agent could not confirm payment ${paymentId ?? 'unknown'}`,
      details: { queueId, attempts, result },
    });

    if (!result.success && result.retryable && hasMoreRetries) throw new Error(result.error || 'Zanaco retryable failure');
    return result;
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (queueId) {
      if (!hasMoreRetries) {
        await reportPaymentResult(queueId, { success: false, status: error?.status ?? 500, error: errorMessage }, attempts);
      } else {
        await reportPaymentProcessing(queueId, attempts, errorMessage);
      }
    }
    await emitAgentAudit({
      action: hasMoreRetries ? 'AGENT_RETRY_SCHEDULED' : 'AGENT_SEND_FAILED',
      correlationId,
      resourceId: paymentId,
      summary: hasMoreRetries ? `Zanaco agent retry scheduled for ${paymentId ?? 'unknown'}` : `Zanaco agent failed payment ${paymentId ?? 'unknown'}`,
      details: { queueId, attempts, error: errorMessage },
    });
    throw error;
  }
});

let claiming = false;
async function claimPortalWork() {
  if (claiming) return;
  claiming = true;
  try {
    const item = await claimNextPayment();
    if (!item) return;
    await paymentQueue.add('send-zanaco-payment', {
      payment: item.payment,
      queueId: item.queueId,
      sourceBank: item.sourceBank ?? null,
    }, {
      attempts: Number(process.env.JOB_ATTEMPTS || 3),
      backoff: { type: 'exponential', delay: Number(process.env.JOB_BACKOFF_MS || 5000) },
      removeOnComplete: true,
      removeOnFail: false,
    });
  } catch (error) {
    console.error('Failed to claim Zanaco portal work', error);
  } finally {
    claiming = false;
  }
}

if (process.env.APP_API_URL) {
  const intervalMs = Number(process.env.PORTAL_CLAIM_INTERVAL_MS || 5000);
  setInterval(() => void claimPortalWork(), intervalMs);
  void claimPortalWork();
}

worker.on('completed', (job: any, returnvalue: any) => {
  console.log(`Zanaco job completed: ${job.id}`, returnvalue);
});

worker.on('failed', (job: any, err: any) => {
  console.error(`Zanaco job failed: ${job?.id}`, err.message);
});

queueScheduler.on('error', (error: any) => {
  console.error('Zanaco queue scheduler error:', error);
});

worker.on('error', (error: any) => {
  console.error('Zanaco worker error:', error);
});

console.log('Zanaco worker started, listening for payments...');
