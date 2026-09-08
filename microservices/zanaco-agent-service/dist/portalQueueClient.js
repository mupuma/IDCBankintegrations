"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimNextPayment = claimNextPayment;
exports.emitAgentAudit = emitAgentAudit;
exports.reportPaymentProcessing = reportPaymentProcessing;
exports.reportPaymentResult = reportPaymentResult;
exports.reportAccepted = reportAccepted;
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
        console.warn('[ZANACO] Portal claim skipped: APP_API_URL or BANK_PULL_API_KEY is missing');
        return null;
    }
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
        throw new Error(`Portal claim failed (${response.status}): ${text}`);
    }
    const body = await response.json();
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
    }
    catch (error) {
        console.error('Failed to emit Zanaco audit event', error);
    }
}
async function reportQueueStatus(queueId, report) {
    const { appApiUrl, bankPullApiKey, agentId } = getPortalConfig();
    if (!appApiUrl || !bankPullApiKey) {
        console.warn('[ZANACO] Portal reporting skipped: APP_API_URL or BANK_PULL_API_KEY is missing');
        return;
    }
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
        throw new Error(`Portal report failed (${response.status}): ${text}`);
    }
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
