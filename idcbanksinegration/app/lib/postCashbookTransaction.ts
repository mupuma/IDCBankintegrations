import { NextRequest, NextResponse } from 'next/server';
import {
  isCashbookAlreadyProcessed,
  isCashbookProcessError,
  processCashbookReceipt,
} from '@/app/lib/cashbookService';
import {
  cashbookConflictResponse,
  cashbookErrorResponse,
  cashbookInvalidRequestResponse,
  cashbookSavedResponse,
  normalizeReceiptRequest,
} from '@/app/lib/cashbookContract';
import { logAuditEvent } from '@/app/lib/auditLog';
import { getSessionUser, isAuthError, requirePermission } from '@/app/lib/rbac';
import { PERMISSIONS } from '@/app/lib/permissions';

const BANK_PULL_API_KEY = process.env.BANK_PULL_API_KEY || null;

export async function postCashbookTransaction(request: NextRequest) {
  const providedApiKey = request.headers.get('x-bank-api-key');
  const sessionToken = request.cookies.get('session')?.value;
  const isApiKeyAuth =
    !sessionToken && Boolean(BANK_PULL_API_KEY && providedApiKey === BANK_PULL_API_KEY);

  if (!sessionToken && !isApiKeyAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let actor: { id: number; username: string } | null = null;
  if (sessionToken) {
    const auth = await requirePermission(request, PERMISSIONS.CASHBOOK_POST);
    if (isAuthError(auth)) return auth;
    actor = { id: auth.id, username: auth.username };
  } else {
    actor = await getSessionUser(request);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      cashbookInvalidRequestResponse('Invalid JSON payload'),
      { status: 400 },
    );
  }

  const receipt = normalizeReceiptRequest(body);
  if (!receipt) {
    return NextResponse.json(
      cashbookInvalidRequestResponse('Invalid receipt request payload'),
      { status: 400 },
    );
  }

  let result;
  try {
    result = await processCashbookReceipt(receipt);
  } catch (error: any) {
    console.error('Unhandled cashbook processing error', error);
    return NextResponse.json(
      cashbookErrorResponse(error?.message ?? 'Unexpected cashbook processing error'),
      { status: 500 },
    );
  }

  if (result.success) {
    await logAuditEvent({
      userId: actor?.id ?? null,
      username: actor?.username ?? (isApiKeyAuth ? 'bank-agent' : null),
      action: 'CASHBOOK_POSTED',
      resourceType: 'cashbook',
      resourceId: receipt.transactionId ? String(receipt.transactionId) : null,
      summary: `${actor?.username ?? 'bank-agent'} posted cashbook transaction ${receipt.transactionId ?? ''}`.trim(),
      details: {
        transactionId: receipt.transactionId ?? null,
        bankCode: receipt.bankCode ?? null,
        creditAmount: receipt.creditAmount ?? null,
      },
      request,
    });
    return NextResponse.json(cashbookSavedResponse(), { status: 200 });
  }

  if (isCashbookAlreadyProcessed(result)) {
    return NextResponse.json(cashbookConflictResponse(), { status: 409 });
  }

  if (isCashbookProcessError(result)) {
    return NextResponse.json(cashbookErrorResponse(result.error), { status: 500 });
  }

  return NextResponse.json(cashbookErrorResponse('Unknown cashbook processing error'), { status: 500 });
}
