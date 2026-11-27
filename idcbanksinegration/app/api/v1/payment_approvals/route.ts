import { NextRequest, NextResponse } from 'next/server';
import { Op } from 'sequelize';
import { APPROVAL_REJECTED, AWAITING_APPROVAL, ApprovalError, canDecide, decidePayment, readApproval } from '@/app/lib/paymentApprovals';
import { rehydrateAndProcessQueueRecord } from '@/app/lib/bankQueue';
import { getBankIntegration } from '@/app/lib/bankIntegrations';
import { PERMISSIONS } from '@/app/lib/permissions';
import { isAuthError, requirePermission } from '@/app/lib/rbac';
import type { BankCode } from '@/app/models/dtos';
import { PaymentQueueRequest } from '@/app/models/internal/PaymentQueueRequest';

export async function GET(request: NextRequest) {
  const user = await requirePermission(request, PERMISSIONS.QUEUES_READ);
  if (isAuthError(user)) return user;
  const history = request.nextUrl.searchParams.get('history') === '1';
  const page = Number(request.nextUrl.searchParams.get('page') ?? '1');
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) return NextResponse.json({ error: 'Invalid page.' }, { status: 400 });
  const { rows, count } = await PaymentQueueRequest.findAndCountAll({
    where: history
      ? { approvalSnapshot: { [Op.ne]: null }, status: { [Op.ne]: AWAITING_APPROVAL } }
      : { status: AWAITING_APPROVAL },
    order: history ? [['updatedAt', 'DESC'], ['id', 'DESC']] : [['createdAt', 'ASC'], ['id', 'ASC']],
    limit: 25, offset: (page - 1) * 25,
  });
  return NextResponse.json({ total: count, items: rows.map(row => {
    const approval = readApproval(row);
    const status = row.status === APPROVAL_REJECTED ? 'Rejected' : row.status;
    return {
      queueId: row.queueId, paymentId: row.paymentId, bankCode: row.bankCode, sourceBank: row.sourceBank, status,
      payment: JSON.parse(row.paymentPayload), approval,
      canDecide: !history && !!approval && canDecide(approval, user.id),
    };
  }) });
}

export async function POST(request: NextRequest) {
  const user = await requirePermission(request, PERMISSIONS.QUEUES_READ);
  if (isAuthError(user)) return user;
  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (typeof body?.queueId !== 'string' || !body.queueId || body.queueId.length > 100
    || typeof body.version !== 'string' || body.version.length !== 36 || !Number.isInteger(body.stage) || !['approve', 'reject'].includes(body.action)
    || reason.length > 500 || (body.action === 'reject' && !reason)) {
    return NextResponse.json({ error: 'Invalid decision. Enter a reason when rejecting a payment.' }, { status: 400 });
  }
  try {
    const row = await decidePayment(body.queueId, body.version, body.stage, body.action, reason, user);
    if (row.status === 'queued' && row.bankCode === 'ZANACO'
      && getBankIntegration(row.bankCode as BankCode).dispatchStrategy === 'portal-push') {
      try { await rehydrateAndProcessQueueRecord(row); }
      catch { /* The persisted queue remains available for recovery. */ }
    }
    return NextResponse.json({ success: true, status: row.status });
  } catch (error) {
    if (error instanceof ApprovalError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
