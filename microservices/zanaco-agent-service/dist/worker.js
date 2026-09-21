"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const queue_1 = require("./queue");
const zanacoValidation_1 = require("./zanacoValidation");
const zanacoAgent_1 = require("./zanacoAgent");
const portalQueueClient_1 = require("./portalQueueClient");
const bulk_1 = require("./bulk");
const log_1 = require("./log");
const worker = (0, queue_1.buildWorker)(async (job) => {
    const payload = job.data;
    if (!payload?.payment)
        throw new Error('Job missing payment payload');
    const queueId = payload.queueId;
    const attempts = job.attemptsMade + 1;
    const hasMoreRetries = typeof job.opts.attempts === 'number'
        ? job.attemptsMade < job.opts.attempts - 1
        : false;
    const reportToPortal = Boolean(queueId && payload.reportToPortal);
    if (reportToPortal && queueId)
        await (0, portalQueueClient_1.reportPaymentProcessing)(queueId, attempts);
    const correlationId = queueId || payload.payment?.paymentId || payload.payment?.transactionReference;
    const paymentId = payload.payment?.paymentId || payload.payment?.transactionReference || correlationId;
    const service = payload.payment?.service;
    const transactionType = payload.payment?.transactionType ?? payload.payment?.meta?.transactionType;
    (0, log_1.logEvent)('worker.job.started', {
        jobId: job.id,
        queueId,
        paymentId,
        service,
        transactionType,
        attempts,
        hasMoreRetries,
        reportToPortal,
    });
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
                (0, log_1.logEvent)('worker.job.prepare_bulk', { jobId: job.id, queueId, paymentId, service: payload.payment.service });
                result = await (0, bulk_1.submitBulk)((0, bulk_1.prepareBulkPayload)(payload.payment.service, payload.payment.request));
            }
            else {
                (0, log_1.logEvent)('worker.job.prepare_service', { jobId: job.id, queueId, paymentId, service: payload.payment.service });
                result = await (0, zanacoAgent_1.sendZanacoPayment)((0, zanacoAgent_1.prepareZanacoServicePayload)(payload.payment));
            }
        }
        else {
            (0, log_1.logEvent)('worker.job.prepare_payment', { jobId: job.id, queueId, paymentId, transactionType });
            result = await (0, zanacoAgent_1.sendZanacoPayment)((0, zanacoAgent_1.prepareZanacoPayload)(payload.payment));
        }
        (0, log_1.logEvent)('worker.job.result', {
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
                await (0, portalQueueClient_1.reportPaymentResult)(queueId, result, attempts);
                (0, log_1.logEvent)('worker.portal.reported_result', { jobId: job.id, queueId, paymentId, status: result.success ? 'success' : result.unknown ? 'unknown' : 'failed', attempts });
            }
            else {
                await (0, portalQueueClient_1.reportPaymentProcessing)(queueId, attempts, result.error);
                (0, log_1.logEvent)('worker.portal.reported_processing', { jobId: job.id, queueId, paymentId, attempts, error: result.error });
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
        (0, log_1.logError)('worker.job.exception', {
            jobId: job.id,
            queueId,
            paymentId,
            attempts,
            hasMoreRetries,
            error: errorMessage,
        });
        if (reportToPortal && queueId) {
            if (!hasMoreRetries) {
                await (0, portalQueueClient_1.reportPaymentResult)(queueId, { success: false, status: error?.status ?? 500, error: errorMessage }, attempts);
                (0, log_1.logEvent)('worker.portal.reported_exception', { jobId: job.id, queueId, paymentId, attempts, error: errorMessage });
            }
            else {
                await (0, portalQueueClient_1.reportPaymentProcessing)(queueId, attempts, errorMessage);
                (0, log_1.logEvent)('worker.portal.reported_retry', { jobId: job.id, queueId, paymentId, attempts, error: errorMessage });
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
            reportToPortal: true,
        }, {
            attempts: Number(process.env.JOB_ATTEMPTS || 3),
            backoff: { type: 'exponential', delay: Number(process.env.JOB_BACKOFF_MS || 5000) },
            removeOnComplete: true,
            removeOnFail: false,
        });
        (0, log_1.logEvent)('worker.portal.claimed', {
            queueId: item.queueId,
            paymentId: item.paymentId,
            sourceBank: item.sourceBank,
            attempts: item.attempts,
        });
    }
    catch (error) {
        (0, log_1.logError)('worker.portal.claim_failed', { error: error instanceof Error ? error.message : String(error) });
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
    (0, log_1.logEvent)('worker.job.completed', { jobId: job.id, queueId: job.data?.queueId, returnvalue });
});
worker.on('failed', (job, err) => {
    (0, log_1.logError)('worker.job.failed', { jobId: job?.id, queueId: job?.data?.queueId, error: err.message });
});
queue_1.queueScheduler.on('error', (error) => {
    (0, log_1.logError)('worker.scheduler.error', { error: error instanceof Error ? error.message : String(error) });
});
worker.on('error', (error) => {
    (0, log_1.logError)('worker.error', { error: error instanceof Error ? error.message : String(error) });
});
(0, log_1.logEvent)('worker.started', { queue: 'zanaco-payments' });
