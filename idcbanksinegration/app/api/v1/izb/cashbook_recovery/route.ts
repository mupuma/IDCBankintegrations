import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, isAuthError } from '@/app/lib/rbac';
import { PERMISSIONS } from '@/app/lib/permissions';
import { loadIzbCashbookRecovery, retryIzbCashbook, CashbookRecoveryError } from '@/app/lib/izbCashbookRecovery';
import { logAuditEvent } from '@/app/lib/auditLog';

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, PERMISSIONS.QUEUES_READ);
  if (isAuthError(auth)) return auth;
  try {
    const { details } = await loadIzbCashbookRecovery(request.nextUrl.searchParams.get('queueId') || '');
    return NextResponse.json(details);
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, PERMISSIONS.CASHBOOK_POST);
  if (isAuthError(auth)) return auth;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.queueId !== 'string' || typeof body.reason !== 'string'
    || body.reason.trim().length < 10 || body.reason.length > 1000
    || Object.keys(body).some(key => !['queueId', 'reason'].includes(key))) {
    return NextResponse.json({ success: false, error: 'Provide a queue ID and a reason of 10 to 1000 characters. Saved cashbook fields cannot be edited here.' }, { status: 400 });
  }
  let transactionId: string | undefined;
  try {
    const { details } = await loadIzbCashbookRecovery(body.queueId);
    transactionId = details.transactionId;
    if (!details.canRetry) throw new CashbookRecoveryError(details.message);
    await logAuditEvent({ userId: auth.id, username: auth.username, action: 'CASHBOOK_RETRY_REQUESTED',
      resourceType: 'cashbook', resourceId: body.queueId, correlationId: transactionId,
      summary: `${auth.username} requested an IZB cashbook retry`, details: { reason: body.reason.trim(), transactionId }, request });
    const result = await retryIzbCashbook(body.queueId);
    await logAuditEvent({ userId: auth.id, username: auth.username, action: 'SAGE_CASHBOOK_SUCCESS',
      resourceType: 'cashbook', resourceId: body.queueId, correlationId: transactionId,
      summary: result.message, details: { transactionId, batchId: result.batchId, reason: body.reason.trim() }, request });
    return NextResponse.json(result);
  } catch (error) {
    if (transactionId) await logAuditEvent({ userId: auth.id, username: auth.username, action: 'SAGE_CASHBOOK_FAILED',
      resourceType: 'cashbook', resourceId: body.queueId, correlationId: transactionId,
      summary: 'IZB cashbook retry did not complete', details: { transactionId, reason: body.reason.trim(),
        error: error instanceof Error ? error.message : 'Unexpected error' }, request });
    return failure(error);
  }
}

function failure(error: unknown) {
  const status = error instanceof CashbookRecoveryError ? error.status : 500;
  if (!(error instanceof CashbookRecoveryError)) console.error('IZB cashbook recovery unavailable', error instanceof Error ? error.message : 'Unknown failure');
  return NextResponse.json({ success: false, error: error instanceof CashbookRecoveryError ? error.message : 'Unable to retry cashbook posting; check the portal log.' }, { status });
}
