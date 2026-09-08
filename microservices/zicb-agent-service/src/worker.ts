import 'dotenv/config';
import { buildWorker, paymentQueue, queueScheduler } from './queue';
import { sendZicbPayment } from './zicbAgent';
import { postCashbook } from './sageClient';
import { initDatabase, updateQueueRequestStatus } from './db';
import type { JobResult } from './types';
import { claimNextPayment, reportPaymentProcessing, reportPaymentResult } from './portalQueueClient';

function getPortalConfig() {
  return {
    appApiUrl: process.env.APP_API_URL?.trim().replace(/\/$/, ''),
    agentAuditApiKey: process.env.AGENT_AUDIT_API_KEY?.trim() || '',
  };
}

async function emitAgentAudit(event: { action: string; correlationId?: string; resourceId?: string; summary: string; details?: Record<string, unknown> }) {
  const { appApiUrl, agentAuditApiKey } = getPortalConfig();
  if (!appApiUrl) return;
  try {
    await fetch(`${appApiUrl}/api/v1/agent_audit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-audit-key': agentAuditApiKey,
      },
      body: JSON.stringify({
        action: event.action,
        resourceType: 'payment',
        resourceId: event.resourceId,
        correlationId: event.correlationId,
        summary: event.summary,
        details: event.details ?? {},
        username: 'zicb-agent',
      }),
    });
  } catch (error) {
    console.error('Failed to emit ZICB audit event', error);
  }
}

initDatabase();

const worker = buildWorker(async (job) => {
  const payload = job.data as { payment: unknown; queueId?: string; sourceBank?: string | null };
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
    await reportPaymentProcessing(queueId, attempts);
  }

  const correlationId = queueId || (payload.payment as any)?.paymentId || (payload.payment as any)?.transactionReference || undefined;
  const paymentId = (payload.payment as any)?.paymentId || (payload.payment as any)?.transactionReference || correlationId;

  await emitAgentAudit({
    action: 'AGENT_SEND_STARTED',
    correlationId,
    resourceId: paymentId,
    summary: `ZICB agent started sending payment ${paymentId ?? 'unknown'}`,
    details: { queueId, attempts },
  });

  try {
    const result = await sendZicbPayment(payload.payment as any);

    // if bank post succeeded, attempt to post cashbook to Sage
    if (result.success) {
      try {
        const payment = payload.payment as any;
        const transactionId = payload.queueId || payment?.paymentId || `zicb-${Date.now()}`;
        const amount = Number(payment?.amount || 0);
        const currency = payment?.currency || payment?.currencyCode || 'ZMW';

        const receipt = {
          transactionId,
          bankCode: 'ZICB',
          Description: payment?.remarks || payment?.transactionReference || 'ZICB cashbook posting',
          noEntries: 1,
          creditAmount: amount,
          debitAmount: amount,
          entries: [
            {
              entryNo: 1,
              referenceNo: payment?.transactionReference || transactionId,
              customerNo: payment?.vendorId || undefined,
              noDetails: 1,
              amount,
              currency,
              details: [
                {
                  entryDescription: payment?.remarks || payment?.transactionReference || 'Auto-post',
                  accountId: process.env.SAGE_CASHBOOK_DEFAULT_ACCOUNT || '4000',
                  amount,
                  DrCr: 'Cr',
                  detailNo: 1,
                },
              ],
            },
          ],
        };

        const sageResp = await postCashbook(receipt as any);
        if (!sageResp.ok) {
          console.warn('Sage cashbook post failed', sageResp.status, sageResp.text);
          await emitAgentAudit({
            action: 'SAGE_CASHBOOK_FAILED',
            correlationId,
            resourceId: paymentId,
            summary: `ZICB agent Sage cashbook post failed for ${transactionId}`,
            details: { queueId, transactionId, status: sageResp.status, body: sageResp.text },
          });
        } else {
          console.log('Sage cashbook posted', transactionId);
          await emitAgentAudit({
            action: 'SAGE_CASHBOOK_SUCCESS',
            correlationId,
            resourceId: paymentId,
            summary: `ZICB agent Sage cashbook posted for ${transactionId}`,
            details: { queueId, transactionId, status: sageResp.status, body: sageResp.text },
          });
        }
      } catch (sageErr) {
        console.error('Sage cashbook posting error', sageErr);
      }
    }

    if (queueId) {
      updateQueueRequestStatus(queueId, {
        status: result.success ? 'success' : (hasMoreRetries ? 'queued' : 'failed'),
        attempts,
        lastError: result.error,
        response: result.data,
        updatedAt: new Date().toISOString(),
      });
      if (result.success || !hasMoreRetries) {
        await reportPaymentResult(queueId, result, attempts);
      } else {
        await reportPaymentProcessing(queueId, attempts, result.error);
      }
    }

    await emitAgentAudit({
      action: result.success ? 'AGENT_SEND_SUCCEEDED' : 'AGENT_SEND_FAILED',
      correlationId,
      resourceId: paymentId,
      summary: result.success ? `ZICB agent completed payment ${paymentId ?? 'unknown'}` : `ZICB agent failed payment ${paymentId ?? 'unknown'}`,
      details: { queueId, attempts, result },
    });

    if (!result.success) {
      throw new Error(result.error || `ZICB send failed with status ${result.status}`);
    }

    return result;
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (queueId) {
      updateQueueRequestStatus(queueId, {
        status: hasMoreRetries ? 'queued' : 'failed',
        attempts,
        lastError: errorMessage,
        updatedAt: new Date().toISOString(),
      });
      if (!hasMoreRetries) {
        await reportPaymentResult(queueId, {
          success: false,
          status: error?.status ?? 500,
          error: errorMessage,
        }, attempts);
      } else {
        await reportPaymentProcessing(queueId, attempts, errorMessage);
      }
    }
    await emitAgentAudit({
      action: hasMoreRetries ? 'AGENT_RETRY_SCHEDULED' : 'AGENT_SEND_FAILED',
      correlationId,
      resourceId: paymentId,
      summary: hasMoreRetries ? `ZICB agent retry scheduled for ${paymentId ?? 'unknown'}` : `ZICB agent failed payment ${paymentId ?? 'unknown'}`,
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

    await paymentQueue.add('send-zicb-payment', {
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
    console.error('Failed to claim ZICB portal work', error);
  } finally {
    claiming = false;
  }
}

if (getPortalConfig().appApiUrl) {
  const intervalMs = Number(process.env.PORTAL_CLAIM_INTERVAL_MS || 5000);
  setInterval(() => void claimPortalWork(), intervalMs);
  void claimPortalWork();
}

worker.on('completed', (job:any, returnvalue:any) => {
  console.log(`ZICB job completed: ${job.id}`, returnvalue);
});

worker.on('failed', (job:any, err:any) => {
  console.error(`ZICB job failed: ${job.id}`, err.message);
});

queueScheduler.on('error', (error:any) => {
  console.error('Queue scheduler error:', error);
});

worker.on('error', (error:any) => {
  console.error('Worker error:', error);
});

console.log('ZICB worker started, listening for payments...');
