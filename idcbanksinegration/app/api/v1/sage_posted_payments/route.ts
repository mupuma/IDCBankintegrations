import type { NextRequest } from 'next/server';
import { isAuthError, requirePermission } from '../../../lib/rbac';
import { PERMISSIONS } from '../../../lib/permissions';
import { GET as listPayments, POST as submitPayment } from '../posted_payments/route';

export async function POST(request: NextRequest) {
  return submitPayment(request);
}

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, PERMISSIONS.QUEUES_READ);
  if (isAuthError(auth)) return auth;
  return listPayments(request);
}
