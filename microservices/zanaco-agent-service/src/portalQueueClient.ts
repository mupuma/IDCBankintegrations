import type { JobResult, QueueReportStatus } from './types';

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

  const body = await response.json() as { item?: ClaimedPortalItem | null };
  return body.item ?? null;
}

export async function emitAgentAudit(event: { action: string; correlationId?: string; resourceId?: string; summary: string; details?: Record<string, unknown> }) {
  const { appApiUrl } = getPortalConfig();
  const agentAuditApiKey = process.env.AGENT_AUDIT_API_KEY?.trim() || '';
  if (!appApiUrl || !agentAuditApiKey) return;

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
  } catch (error) {
    console.error('Failed to emit Zanaco audit event', error);
  }
}

async function reportQueueStatus(queueId: string, report: QueueStatusReport) {
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

export async function reportPaymentProcessing(queueId: string, attempts?: number, error?: string) {
  await reportQueueStatus(queueId, { status: 'processing', attempts, error });
}

export async function reportPaymentResult(queueId: string, result: JobResult, attempts?: number) {
  await reportQueueStatus(queueId, {
    status: result.success ? 'success' : result.unknown ? 'unknown' : 'failed',
    response: result.data,
    error: result.error,
    attempts,
  });
}

export async function reportAccepted(queueId: string, response: unknown, attempts?: number) {
  await reportQueueStatus(queueId, { status: 'accepted', response, attempts });
}
