"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const queue_1 = require("./queue");
const paymentProcessor_1 = require("./paymentProcessor");
const zanacoValidation_1 = require("./zanacoValidation");
const zanacoAgent_1 = require("./zanacoAgent");
const portalQueueClient_1 = require("./portalQueueClient");
const bulk_1 = require("./bulk");
const log_1 = require("./log");
const zwsClient_1 = require("./zwsClient");
(0, zwsClient_1.validateZanacoConfiguration)();
const worker = (0, queue_1.buildWorker)(async (job) => {
    (0, log_1.logEvent)('worker.job.started', { jobId: job.id, queueId: job.data?.queueId, attempts: job.attemptsMade + 1 });
    return (0, paymentProcessor_1.processPaymentJob)(job, {
        prepare(payment) {
            if (!payment)
                throw new Error('Job missing payment payload');
            if ((0, zanacoValidation_1.isZanacoServicePayload)(payment)) {
                return (0, bulk_1.isBulkService)(payment.service)
                    ? (0, bulk_1.prepareBulkPayload)(payment.service, payment.request)
                    : (0, zanacoAgent_1.prepareZanacoServicePayload)(payment);
            }
            return (0, zanacoAgent_1.prepareZanacoPayload)(payment);
        },
        submit: prepared => (0, bulk_1.isBulkService)(prepared.service) ? (0, bulk_1.submitBulk)(prepared) : (0, zanacoAgent_1.sendZanacoPayment)(prepared),
        reserve: (prepared, queueId) => (0, zanacoAgent_1.isPaymentSubmission)(prepared) || (0, bulk_1.isBulkService)(prepared.service)
            ? (0, queue_1.reserveBankReferences)(prepared, queueId) : Promise.resolve(),
        beginSubmission: queue_1.markSubmissionStarted,
        reconcile: (prepared, previous) => (0, bulk_1.isBulkService)(prepared.service)
            ? (0, bulk_1.reconcileBulk)(previous)
            : prepared.service === 'ZANACO_NFS_TRANSFER'
                ? Promise.resolve({ success: false, status: 503, unknown: true, error: 'NFS status recovery requires bank confirmation; manual reconciliation required' })
                : (0, zanacoAgent_1.isPaymentSubmission)(prepared) ? (0, zanacoAgent_1.queryTransactionStatus)(prepared.externalTranRef) : (0, zanacoAgent_1.sendZanacoPayment)(prepared),
        report: async (queueId, result, attempts) => {
            await (0, portalQueueClient_1.reportPaymentResult)(queueId, result, attempts);
            await (0, portalQueueClient_1.emitAgentAudit)({
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
    if (claiming)
        return;
    claiming = true;
    try {
        const item = await (0, portalQueueClient_1.claimNextPayment)();
        if (!item)
            return;
        await (0, queue_1.enqueuePaymentWork)(item.payment, item.queueId, item.sourceBank ?? null, true);
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
