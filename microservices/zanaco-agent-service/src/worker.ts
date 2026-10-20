import 'dotenv/config';
import { buildWorker, enqueuePaymentWork, queueScheduler, reserveBankReferences, markSubmissionStarted } from './queue';
import { processPaymentJob } from './paymentProcessor';
import { isZanacoServicePayload } from './zanacoValidation';
import { prepareZanacoPayload, prepareZanacoServicePayload, sendZanacoPayment, queryTransactionStatus, isPaymentSubmission } from './zanacoAgent';
import { claimNextPayment, emitAgentAudit, reportPaymentResult } from './portalQueueClient';
import { isBulkService, prepareBulkPayload, submitBulk, reconcileBulk } from './bulk';
import { logEvent, logError } from './log';
import { validateZanacoConfiguration } from './zwsClient';

validateZanacoConfiguration();
const worker = buildWorker(async (job) => {
  logEvent('worker.job.started', { jobId: job.id, queueId: job.data?.queueId, attempts: job.attemptsMade + 1 });
  return processPaymentJob(job, {
    prepare(payment: unknown) {
      if (!payment) throw new Error('Job missing payment payload');
      if (isZanacoServicePayload(payment)) {
        return isBulkService(payment.service)
          ? prepareBulkPayload(payment.service, payment.request)
          : prepareZanacoServicePayload(payment);
      }
      return prepareZanacoPayload(payment as any);
    },
    submit: prepared => isBulkService(prepared.service) ? submitBulk(prepared) : sendZanacoPayment(prepared),
    reserve: (prepared, queueId) => isPaymentSubmission(prepared) || isBulkService(prepared.service)
      ? reserveBankReferences(prepared, queueId) : Promise.resolve(),
    beginSubmission: markSubmissionStarted,
    reconcile: (prepared, previous) => isBulkService(prepared.service)
      ? reconcileBulk(previous)
      : prepared.service === 'ZANACO_NFS_TRANSFER'
        ? Promise.resolve({ success: false, status: 503, unknown: true, error: 'NFS status recovery requires bank confirmation; manual reconciliation required' })
        : isPaymentSubmission(prepared) ? queryTransactionStatus(prepared.externalTranRef) : sendZanacoPayment(prepared),
    report: async (queueId, result, attempts) => {
      await reportPaymentResult(queueId, result, attempts);
      await emitAgentAudit({
        action: result.success ? 'AGENT_SEND_SUCCEEDED' : result.unknown || result.accepted ? 'AGENT_SEND_UNKNOWN' : 'AGENT_SEND_FAILED',
        correlationId: queueId, resourceId: queueId,
        summary: `Zanaco outcome reported for ${queueId}`,
        details: { attempts, status: result.status, error: result.error },
      });
    },
  });
});

let claiming = false;
async function claimPortalWork() {
  if (claiming) return;
  claiming = true;
  try {
    const item = await claimNextPayment();
    if (!item) return;
    await enqueuePaymentWork(item.payment, item.queueId, item.sourceBank ?? null, true);
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
