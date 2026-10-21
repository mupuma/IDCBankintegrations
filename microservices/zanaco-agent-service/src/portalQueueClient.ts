import type { JobResult, QueueReportStatus } from './types';

import { logEvent, logError } from './log';
import type { RecoveryCommand } from './recovery';

async function recoveryRequest(method: string, body?: unknown) {
  const { appApiUrl, bankPullApiKey } = getPortalConfig();
  if (!appApiUrl || !bankPullApiKey) throw new Error('Portal configuration is missing');
  const response = await fetch(`${appApiUrl}/api/v1/agent_recovery`, {
    method, headers: { 'Content-Type': 'application/json', 'x-bank-api-key': bankPullApiKey },
    body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`Recovery request failed (HTTP ${response.status})`);
  return response.json();
}
export async function claimNextRecovery(): Promise<RecoveryCommand | null> { return (await recoveryRequest('POST')).item ?? null; }
export async function reportRecovery(command: RecoveryCommand, success: boolean, message: string) {
  await recoveryRequest('PATCH', { actionId: command.actionId, leaseToken: command.leaseToken, success, message });
}

function getPortalConfig() {
  return {
    appApiUrl: process.env.APP_API_URL?.trim().replace(/\/$/, ''),
    bankPullApiKey: process.env.BANK_PULL_API_KEY?.trim() || '',
    agentId: process.env.AGENT_ID?.trim() || 'zanaco-agent',
  };
}

export type ClaimedPortalItem = {
  queueId: string;
  paymentId: string;
  bankCode: 'ZANACO';
  sourceBank?: string | null;
  payment: unknown;
  attempts: number;
};

type QueueStatusReport = {
  status: QueueReportStatus;
  response?: unknown;
  error?: string;
  attempts?: number;
};

export async function claimNextPayment(): Promise<ClaimedPortalItem | null> {
  const { appApiUrl, bankPullApiKey, agentId } = getPortalConfig();

  if (!appApiUrl || !bankPullApiKey) {
    logError('portal.claim.config_missing', { hasAppApiUrl: Boolean(appApiUrl), hasBankPullApiKey: Boolean(bankPullApiKey) });
    return null;
  }

  logEvent('portal.claim.request', { appApiUrl, agentId });
  const response = await fetch(`${appApiUrl}/api/v1/agent_queue/claim`, {
    method: 'POST',
    signal: AbortSignal.timeout(120000),
    redirect: 'error',
    headers: {
      'Content-Type': 'application/json',
      'x-bank-api-key': bankPullApiKey,
    },
    body: JSON.stringify({ bankCode: 'ZANACO', agentId }),
  });

  if (!response.ok) {
    const text = await response.text();
    logError('portal.claim.response_error', { status: response.status, body: text });
    throw new Error(`Portal claim failed (${response.status}): ${text}`);
  }

  const body = await response.json() as { item?: ClaimedPortalItem | null };
  logEvent('portal.claim.response', {
    claimed: Boolean(body.item),
    queueId: body.item?.queueId,
    paymentId: body.item?.paymentId,
    attempts: body.item?.attempts,
  });
  return body.item ?? null;
}

export async function emitAgentAudit(event: { action: string; correlationId?: string; resourceId?: string; summary: string; details?: Record<string, unknown> }) {
  const { appApiUrl } = getPortalConfig();
  const agentAuditApiKey = process.env.AGENT_AUDIT_API_KEY?.trim() || '';
  if (!appApiUrl || !agentAuditApiKey) return;

  try {
    await fetch(`${appApiUrl}/api/v1/agent_audit`, {
      method: 'POST',
      signal: AbortSignal.timeout(120000),
      redirect: 'error',
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
    logEvent('portal.audit.sent', { action: event.action, correlationId: event.correlationId, resourceId: event.resourceId });
  } catch (error) {
    logError('portal.audit.failed', { action: event.action, correlationId: event.correlationId, error: error instanceof Error ? error.message : String(error) });
  }
}

async function reportQueueStatus(queueId: string, report: QueueStatusReport) {
  const { appApiUrl, bankPullApiKey, agentId } = getPortalConfig();

  if (!appApiUrl || !bankPullApiKey) {
    logError('portal.report.config_missing', { queueId, status: report.status, hasAppApiUrl: Boolean(appApiUrl), hasBankPullApiKey: Boolean(bankPullApiKey) });
    throw new Error('APP_API_URL and BANK_PULL_API_KEY are required for portal reporting');
  }

  logEvent('portal.report.request', { queueId, status: report.status, attempts: report.attempts, error: report.error });
  const response = await fetch(`${appApiUrl}/api/v1/agent_queue/report`, {
    method: 'POST',
    signal: AbortSignal.timeout(120000),
    redirect: 'error',
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
    logError('portal.report.response_error', { queueId, status: report.status, httpStatus: response.status, body: text });
    throw new Error(`Portal report failed (${response.status}): ${text}`);
  }
  logEvent('portal.report.response', { queueId, status: report.status, httpStatus: response.status });
}

export async function reportPaymentProcessing(queueId: string, attempts?: number, error?: string) {
  await reportQueueStatus(queueId, { status: 'processing', attempts, error });
}

export async function reportPaymentResult(queueId: string, result: JobResult, attempts?: number) {
  await reportQueueStatus(queueId, {
    status: result.success ? 'success' : result.accepted ? 'accepted' : result.unknown ? 'unknown' : 'failed',
    response: {
      ...(result.data && typeof result.data === 'object' ? result.data : {}),
      recovery: { protocol: 'zanaco-recovery-v1', notSent: Boolean(result.notSent),
        retryable: Boolean(result.notSent && result.retryable), confirmedRejected: Boolean(result.confirmedRejected) },
    },
    error: result.error,
    attempts,
  });
}

export async function reportAccepted(queueId: string, response: unknown, attempts?: number) {
  await reportQueueStatus(queueId, { status: 'accepted', response, attempts });
}
