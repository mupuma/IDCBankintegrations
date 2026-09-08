"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const queue_1 = require("./queue");
const izbAgent_1 = require("./izbAgent");
const db_1 = require("./db");
const portalQueueClient_1 = require("./portalQueueClient");
function getPortalConfig() {
    return {
        appApiUrl: process.env.APP_API_URL?.trim().replace(/\/$/, ''),
        agentAuditApiKey: process.env.AGENT_AUDIT_API_KEY?.trim() || '',
    };
}
async function emitAgentAudit(event) {
    const { appApiUrl, agentAuditApiKey } = getPortalConfig();
    if (!appApiUrl)
        return;
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
                username: 'izb-agent',
            }),
        });
    }
    catch (error) {
        console.error('Failed to emit IZB audit event', error);
    }
}
(0, db_1.initDatabase)();
const worker = (0, queue_1.buildWorker)(async (job) => {
    const payload = job.data;
    if (!payload?.payment) {
        throw new Error('Job missing payment payload');
    }
    const queueId = payload.queueId;
    const attempts = job.attemptsMade + 1;
    const hasMoreRetries = typeof job.opts.attempts === 'number'
        ? job.attemptsMade < job.opts.attempts - 1
        : false;
    if (queueId) {
        (0, db_1.updateQueueRequestStatus)(queueId, {
            status: 'processing',
            attempts,
            lastError: undefined,
            updatedAt: new Date().toISOString(),
        });
        await (0, portalQueueClient_1.reportPaymentProcessing)(queueId, attempts);
    }
    const correlationId = queueId || payload.payment?.paymentId || payload.payment?.transactionReference || undefined;
    const paymentId = payload.payment?.paymentId || payload.payment?.transactionReference || correlationId;
    await emitAgentAudit({
        action: 'AGENT_SEND_STARTED',
        correlationId,
        resourceId: paymentId,
        summary: `IZB agent started sending payment ${paymentId ?? 'unknown'}`,
        details: { queueId, attempts },
    });
    try {
        const result = await (0, izbAgent_1.sendIzbPayment)(payload.payment);
        // NOTE: cashbook posting is handled by the bank posting receipts back to the portal.
        if (queueId) {
            (0, db_1.updateQueueRequestStatus)(queueId, {
                status: result.success ? 'success' : (hasMoreRetries ? 'queued' : 'failed'),
                attempts,
                lastError: result.error,
                response: result.data,
                updatedAt: new Date().toISOString(),
            });
            if (result.success || !hasMoreRetries) {
                await (0, portalQueueClient_1.reportPaymentResult)(queueId, result, attempts);
            }
            else {
                await (0, portalQueueClient_1.reportPaymentProcessing)(queueId, attempts, result.error);
            }
        }
        await emitAgentAudit({
            action: result.success ? 'AGENT_SEND_SUCCEEDED' : 'AGENT_SEND_FAILED',
            correlationId,
            resourceId: paymentId,
            summary: result.success ? `IZB agent completed payment ${paymentId ?? 'unknown'}` : `IZB agent failed payment ${paymentId ?? 'unknown'}`,
            details: { queueId, attempts, result },
        });
        if (!result.success) {
            throw new Error(result.error || `IZB send failed with status ${result.status}`);
        }
        return result;
    }
    catch (error) {
        if (queueId) {
            (0, db_1.updateQueueRequestStatus)(queueId, {
                status: hasMoreRetries ? 'queued' : 'failed',
                attempts,
                lastError: String(error),
                updatedAt: new Date().toISOString(),
            });
            if (!hasMoreRetries) {
                await (0, portalQueueClient_1.reportPaymentResult)(queueId, {
                    success: false,
                    status: error?.status ?? 500,
                    error: String(error),
                }, attempts);
            }
            else {
                await (0, portalQueueClient_1.reportPaymentProcessing)(queueId, attempts, String(error));
            }
        }
        await emitAgentAudit({
            action: hasMoreRetries ? 'AGENT_RETRY_SCHEDULED' : 'AGENT_SEND_FAILED',
            correlationId,
            resourceId: paymentId,
            summary: hasMoreRetries ? `IZB agent retry scheduled for ${paymentId ?? 'unknown'}` : `IZB agent failed payment ${paymentId ?? 'unknown'}`,
            details: { queueId, attempts, error: String(error) },
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
        await queue_1.paymentQueue.add('send-izb-payment', {
            payment: item.payment,
            queueId: item.queueId,
        }, {
            attempts: Number(process.env.JOB_ATTEMPTS || 3),
            backoff: { type: 'exponential', delay: Number(process.env.JOB_BACKOFF_MS || 5000) },
            removeOnComplete: true,
            removeOnFail: false,
        });
    }
    catch (error) {
        console.error('Failed to claim IZB portal work', error);
    }
    finally {
        claiming = false;
    }
}
if (getPortalConfig().appApiUrl) {
    const intervalMs = Number(process.env.PORTAL_CLAIM_INTERVAL_MS || 5000);
    setInterval(() => void claimPortalWork(), intervalMs);
    void claimPortalWork();
}
worker.on('completed', (job, returnvalue) => {
    console.log(`IZB job completed: ${job.id}`, returnvalue);
});
worker.on('failed', (job, err) => {
    console.error(`IZB job failed: ${job.id}`, err.message);
});
queue_1.queueScheduler.on('error', (error) => {
    console.error('Queue scheduler error:', error);
});
worker.on('error', (error) => {
    console.error('Worker error:', error);
});
console.log('IZB worker started, listening for payments...');
