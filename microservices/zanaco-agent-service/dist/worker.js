"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const queue_1 = require("./queue");
const zanacoValidation_1 = require("./zanacoValidation");
const zanacoAgent_1 = require("./zanacoAgent");
const portalQueueClient_1 = require("./portalQueueClient");
const bulk_1 = require("./bulk");
const worker = (0, queue_1.buildWorker)(async (job) => {
    const payload = job.data;
    if (!payload?.payment)
        throw new Error('Job missing payment payload');
    const queueId = payload.queueId;
    const attempts = job.attemptsMade + 1;
    const hasMoreRetries = typeof job.opts.attempts === 'number'
        ? job.attemptsMade < job.opts.attempts - 1
        : false;
    if (queueId)
        await (0, portalQueueClient_1.reportPaymentProcessing)(queueId, attempts);
    const correlationId = queueId || payload.payment?.paymentId || payload.payment?.transactionReference;
    const paymentId = payload.payment?.paymentId || payload.payment?.transactionReference || correlationId;
    await (0, portalQueueClient_1.emitAgentAudit)({
        action: 'AGENT_SEND_STARTED',
        correlationId,
        resourceId: paymentId,
        summary: `Zanaco agent started payment ${paymentId ?? 'unknown'}`,
        details: { queueId, attempts },
    });
    try {
        let result;
        if ((0, zanacoValidation_1.isZanacoServicePayload)(payload.payment)) {
            if ((0, bulk_1.isBulkService)(payload.payment.service)) {
                result = await (0, bulk_1.submitBulk)((0, bulk_1.prepareBulkPayload)(payload.payment.service, payload.payment.request));
            }
            else {
                result = await (0, zanacoAgent_1.sendZanacoPayment)((0, zanacoAgent_1.prepareZanacoServicePayload)(payload.payment));
            }
        }
        else {
            result = await (0, zanacoAgent_1.sendZanacoPayment)((0, zanacoAgent_1.prepareZanacoPayload)(payload.payment));
        }
        if (queueId) {
            if (result.success || !hasMoreRetries || !result.retryable) {
                await (0, portalQueueClient_1.reportPaymentResult)(queueId, result, attempts);
            }
            else {
                await (0, portalQueueClient_1.reportPaymentProcessing)(queueId, attempts, result.error);
            }
        }
        await (0, portalQueueClient_1.emitAgentAudit)({
            action: result.success ? 'AGENT_SEND_SUCCEEDED' : result.unknown ? 'AGENT_SEND_UNKNOWN' : 'AGENT_SEND_FAILED',
            correlationId,
            resourceId: paymentId,
            summary: result.success ? `Zanaco agent completed payment ${paymentId ?? 'unknown'}` : `Zanaco agent could not confirm payment ${paymentId ?? 'unknown'}`,
            details: { queueId, attempts, result },
        });
        if (!result.success && result.retryable && hasMoreRetries)
            throw new Error(result.error || 'Zanaco retryable failure');
        return result;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (queueId) {
            if (!hasMoreRetries) {
                await (0, portalQueueClient_1.reportPaymentResult)(queueId, { success: false, status: error?.status ?? 500, error: errorMessage }, attempts);
            }
            else {
                await (0, portalQueueClient_1.reportPaymentProcessing)(queueId, attempts, errorMessage);
            }
        }
        await (0, portalQueueClient_1.emitAgentAudit)({
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
    if (claiming)
        return;
    claiming = true;
    try {
        const item = await (0, portalQueueClient_1.claimNextPayment)();
        if (!item)
            return;
        await queue_1.paymentQueue.add('send-zanaco-payment', {
            payment: item.payment,
            queueId: item.queueId,
            sourceBank: item.sourceBank ?? null,
        }, {
            attempts: Number(process.env.JOB_ATTEMPTS || 3),
            backoff: { type: 'exponential', delay: Number(process.env.JOB_BACKOFF_MS || 5000) },
            removeOnComplete: true,
            removeOnFail: false,
        });
    }
    catch (error) {
        console.error('Failed to claim Zanaco portal work', error);
    }
    finally {
        claiming = false;
    }
}
if (process.env.APP_API_URL) {
    const intervalMs = Number(process.env.PORTAL_CLAIM_INTERVAL_MS || 5000);
    setInterval(() => void claimPortalWork(), intervalMs);
    void claimPortalWork();
}
worker.on('completed', (job, returnvalue) => {
    console.log(`Zanaco job completed: ${job.id}`, returnvalue);
});
worker.on('failed', (job, err) => {
    console.error(`Zanaco job failed: ${job?.id}`, err.message);
});
queue_1.queueScheduler.on('error', (error) => {
    console.error('Zanaco queue scheduler error:', error);
});
worker.on('error', (error) => {
    console.error('Zanaco worker error:', error);
});
console.log('Zanaco worker started, listening for payments...');
