import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { PERMISSIONS } from '@/app/lib/permissions';
import { isAuthError, requirePermission } from '@/app/lib/rbac';
import { listSourceBanks } from '@/app/lib/sourceAccounts';

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, PERMISSIONS.PAYMENTS_READ);
  if (isAuthError(auth)) return auth;

  try {
    const items = await listSourceBanks();
    return NextResponse.json({ success: true, items });
  } catch (error: unknown) {
    console.error('Failed to load source banks', error);
    const message = error instanceof Error ? error.message : 'Failed to load source banks';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
