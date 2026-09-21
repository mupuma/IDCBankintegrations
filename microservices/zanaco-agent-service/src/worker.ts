import 'dotenv/config';
import { buildWorker, paymentQueue, queueScheduler } from './queue';
import { isZanacoServicePayload } from './zanacoValidation';
import { prepareZanacoPayload, prepareZanacoServicePayload, sendZanacoPayment } from './zanacoAgent';
import { claimNextPayment, emitAgentAudit, reportPaymentProcessing, reportPaymentResult } from './portalQueueClient';
import { isBulkService, prepareBulkPayload, submitBulk } from './bulk';
import { logEvent, logError } from './log';

const worker = buildWorker(async (job) => {
  const payload = job.data as { payment: unknown; queueId?: string; sourceBank?: string | null; reportToPortal?: boolean };
  if (!payload?.payment) throw new Error('Job missing payment payload');

  const queueId = payload.queueId;
  const attempts = job.attemptsMade + 1;
  const hasMoreRetries = typeof job.opts.attempts === 'number'
    ? job.attemptsMade < job.opts.attempts - 1
    : false;

  const reportToPortal = Boolean(queueId && payload.reportToPortal);

  if (reportToPortal && queueId) await reportPaymentProcessing(queueId, attempts);

  const correlationId = queueId || (payload.payment as any)?.paymentId || (payload.payment as any)?.transactionReference;
  const paymentId = (payload.payment as any)?.paymentId || (payload.payment as any)?.transactionReference || correlationId;
  const service = (payload.payment as any)?.service;
  const transactionType = (payload.payment as any)?.transactionType ?? (payload.payment as any)?.meta?.transactionType;

  logEvent('worker.job.started', {
    jobId: job.id,
    queueId,
    paymentId,
    service,
    transactionType,
    attempts,
    hasMoreRetries,
    reportToPortal,
  });

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
        logEvent('worker.job.prepare_bulk', { jobId: job.id, queueId, paymentId, service: payload.payment.service });
        result = await submitBulk(prepareBulkPayload(payload.payment.service, payload.payment.request));
      } else {
        logEvent('worker.job.prepare_service', { jobId: job.id, queueId, paymentId, service: payload.payment.service });
        result = await sendZanacoPayment(prepareZanacoServicePayload(payload.payment));
      }
    } else {
      logEvent('worker.job.prepare_payment', { jobId: job.id, queueId, paymentId, transactionType });
      result = await sendZanacoPayment(prepareZanacoPayload(payload.payment as any));
    }

    logEvent('worker.job.result', {
      jobId: job.id,
      queueId,
      paymentId,
      success: result.success,
      status: result.status,
      retryable: result.retryable,
      unknown: result.unknown,
      error: result.error,
    });

    if (reportToPortal && queueId) {
      if (result.success || !hasMoreRetries || !result.retryable) {
        await reportPaymentResult(queueId, result, attempts);
        logEvent('worker.portal.reported_result', { jobId: job.id, queueId, paymentId, status: result.success ? 'success' : result.unknown ? 'unknown' : 'failed', attempts });
      } else {
        await reportPaymentProcessing(queueId, attempts, result.error);
        logEvent('worker.portal.reported_processing', { jobId: job.id, queueId, paymentId, attempts, error: result.error });
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
    logError('worker.job.exception', {
      jobId: job.id,
      queueId,
      paymentId,
      attempts,
      hasMoreRetries,
      error: errorMessage,
    });
    if (reportToPortal && queueId) {
      if (!hasMoreRetries) {
        await reportPaymentResult(queueId, { success: false, status: error?.status ?? 500, error: errorMessage }, attempts);
        logEvent('worker.portal.reported_exception', { jobId: job.id, queueId, paymentId, attempts, error: errorMessage });
      } else {
        await reportPaymentProcessing(queueId, attempts, errorMessage);
        logEvent('worker.portal.reported_retry', { jobId: job.id, queueId, paymentId, attempts, error: errorMessage });
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
      reportToPortal: true,
    }, {
      attempts: Number(process.env.JOB_ATTEMPTS || 3),
      backoff: { type: 'exponential', delay: Number(process.env.JOB_BACKOFF_MS || 5000) },
      removeOnComplete: true,
      removeOnFail: false,
    });
    logEvent('worker.portal.claimed', {
      queueId: item.queueId,
      paymentId: item.paymentId,
      sourceBank: item.sourceBank,
      attempts: item.attempts,
    });
  } catch (error) {
    logError('worker.portal.claim_failed', { error: error instanceof Error ? error.message : String(error) });
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
  logEvent('worker.job.completed', { jobId: job.id, queueId: job.data?.queueId, returnvalue });
});

worker.on('failed', (job: any, err: any) => {
  logError('worker.job.failed', { jobId: job?.id, queueId: job?.data?.queueId, error: err.message });
});

queueScheduler.on('error', (error: any) => {
  logError('worker.scheduler.error', { error: error instanceof Error ? error.message : String(error) });
});

worker.on('error', (error: any) => {
  logError('worker.error', { error: error instanceof Error ? error.message : String(error) });
});

logEvent('worker.started', { queue: 'zanaco-payments' });
