"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimNextPayment = claimNextPayment;
exports.emitAgentAudit = emitAgentAudit;
exports.reportPaymentProcessing = reportPaymentProcessing;
exports.reportPaymentResult = reportPaymentResult;
exports.reportAccepted = reportAccepted;
const log_1 = require("./log");
function getPortalConfig() {
    return {
        appApiUrl: process.env.APP_API_URL?.trim().replace(/\/$/, ''),
        bankPullApiKey: process.env.BANK_PULL_API_KEY?.trim() || '',
        agentId: process.env.AGENT_ID?.trim() || 'zanaco-agent',
    };
}
async function claimNextPayment() {
    const { appApiUrl, bankPullApiKey, agentId } = getPortalConfig();
    if (!appApiUrl || !bankPullApiKey) {
        (0, log_1.logError)('portal.claim.config_missing', { hasAppApiUrl: Boolean(appApiUrl), hasBankPullApiKey: Boolean(bankPullApiKey) });
        return null;
    }
    (0, log_1.logEvent)('portal.claim.request', { appApiUrl, agentId });
    const response = await fetch(`${appApiUrl}/api/v1/agent_queue/claim`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-bank-api-key': bankPullApiKey,
        },
        body: JSON.stringify({ bankCode: 'ZANACO', agentId }),
    });
    if (!response.ok) {
        const text = await response.text();
        (0, log_1.logError)('portal.claim.response_error', { status: response.status, body: text });
        throw new Error(`Portal claim failed (${response.status}): ${text}`);
    }
    const body = await response.json();
    (0, log_1.logEvent)('portal.claim.response', {
        claimed: Boolean(body.item),
        queueId: body.item?.queueId,
        paymentId: body.item?.paymentId,
        attempts: body.item?.attempts,
    });
    return body.item ?? null;
}
async function emitAgentAudit(event) {
    const { appApiUrl } = getPortalConfig();
    const agentAuditApiKey = process.env.AGENT_AUDIT_API_KEY?.trim() || '';
    if (!appApiUrl || !agentAuditApiKey)
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
                username: 'zanaco-agent',
            }),
        });
        (0, log_1.logEvent)('portal.audit.sent', { action: event.action, correlationId: event.correlationId, resourceId: event.resourceId });
    }
    catch (error) {
        (0, log_1.logError)('portal.audit.failed', { action: event.action, correlationId: event.correlationId, error: error instanceof Error ? error.message : String(error) });
    }
}
async function reportQueueStatus(queueId, report) {
    const { appApiUrl, bankPullApiKey, agentId } = getPortalConfig();
    if (!appApiUrl || !bankPullApiKey) {
        (0, log_1.logError)('portal.report.config_missing', { queueId, status: report.status, hasAppApiUrl: Boolean(appApiUrl), hasBankPullApiKey: Boolean(bankPullApiKey) });
        return;
    }
    (0, log_1.logEvent)('portal.report.request', { queueId, status: report.status, attempts: report.attempts, error: report.error });
    const response = await fetch(`${appApiUrl}/api/v1/agent_queue/report`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-bank-api-key': bankPullApiKey,
        },
        body: JSON.stringify({
            queueId,
            agentId,
            status: report.status,
            response: report.response,
            error: report.error,
            attempts: report.attempts,
        }),
    });
    if (!response.ok) {
        const text = await response.text();
        (0, log_1.logError)('portal.report.response_error', { queueId, status: report.status, httpStatus: response.status, body: text });
        throw new Error(`Portal report failed (${response.status}): ${text}`);
    }
    (0, log_1.logEvent)('portal.report.response', { queueId, status: report.status, httpStatus: response.status });
}
async function reportPaymentProcessing(queueId, attempts, error) {
    await reportQueueStatus(queueId, { status: 'processing', attempts, error });
}
async function reportPaymentResult(queueId, result, attempts) {
    await reportQueueStatus(queueId, {
        status: result.success ? 'success' : result.unknown ? 'unknown' : 'failed',
        response: result.data,
        error: result.error,
        attempts,
    });
}
async function reportAccepted(queueId, response, attempts) {
    await reportQueueStatus(queueId, { status: 'accepted', response, attempts });
}
