import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, isAuthError } from '@/app/lib/rbac';
import { PERMISSIONS } from '@/app/lib/permissions';
import { getRecoveryDetails, requestPaymentRecovery, RecoveryError } from '@/app/lib/paymentRecovery';
import type { RecoveryAction } from '@/app/lib/paymentRecoveryPolicy';
import { PaymentQueueRequest } from '@/app/models/internal/PaymentQueueRequest';
import { enqueuePayment, ensureQueueItemProcessing } from '@/app/lib/bankQueue';
import { getBankIntegration } from '@/app/lib/bankIntegrations';

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, PERMISSIONS.QUEUES_READ);
  if (isAuthError(auth)) return auth;
  try {
    const queueId = request.nextUrl.searchParams.get('queueId') || '';
    if (!queueId || queueId.length > 100) throw new RecoveryError('A valid queue ID is required', 400);
    return NextResponse.json({ success: true, ...await getRecoveryDetails(queueId) });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const auth = await requirePermission(request, body?.action === 'new_attempt' ? PERMISSIONS.PAYMENTS_RETRY : PERMISSIONS.PAYMENTS_POST);
  if (isAuthError(auth)) return auth;
  try {
    if (!body || typeof body.queueId !== 'string' || body.queueId.length > 100
      || typeof body.reason !== 'string' || typeof body.actionId !== 'string') throw new RecoveryError('Invalid recovery request', 400);
    const result = await requestPaymentRecovery({ queueId: body.queueId, action: body.action as RecoveryAction,
      actionId: body.actionId, reason: body.reason, corrections: body.corrections, confirmed: body.confirmed, username: auth.username });
    if (result.queueId && result.isNewAction) {
      // New Zanaco attempts use the existing dispatch strategy. ZICB remains on
      // the H2H ledger path and must never enter legacy portal-push processing.
      const row = await PaymentQueueRequest.findOne({ where: { queueId: result.queueId } });
      if (row?.bankCode === 'ZANACO' && row.status === 'queued') {
        const item = enqueuePayment('ZANACO', JSON.parse(row.paymentPayload), row.queueId, row.sourceBank);
        if (getBankIntegration('ZANACO').dispatchStrategy === 'portal-push') {
          void ensureQueueItemProcessing(item.id).catch(error => console.error('Recovery dispatch deferred', error));
        }
      }
    }
    return NextResponse.json({ success: true, ...result }, { status: 202 });
  } catch (error) { return failure(error); }
}

function failure(error: unknown) {
  const value = error as { status?: number; name?: string; message?: string };
  const status = value.name === 'SequelizeUniqueConstraintError' ? 409 : value.status || 400;
  return NextResponse.json({ success: false, error: value.message || 'Unable to schedule recovery' }, { status });
}
