import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, isAuthError } from '@/app/lib/rbac';
import { PERMISSIONS } from '@/app/lib/permissions';
import { listBankIntegrations, createBankDraft, updateBankRegistration, BankRegistryError } from '@/app/lib/bankRegistry';
import { logAuditEvent } from '@/app/lib/auditLog';

export async function GET(request: NextRequest) {
  const administration = request.nextUrl.searchParams.get('administration') === 'true';
  const auth = await requirePermission(request, administration ? PERMISSIONS.BANK_INTEGRATIONS_MANAGE : PERMISSIONS.PAYMENTS_READ);
  if (isAuthError(auth)) return auth;
  try { return NextResponse.json({ success: true, items: await listBankIntegrations(administration) }); }
  catch (error) { return failure(error); }
}

async function save(request: NextRequest, create: boolean) {
  const auth = await requirePermission(request, PERMISSIONS.BANK_INTEGRATIONS_MANAGE);
  if (isAuthError(auth)) return auth;
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BankRegistryError('A bank registration object is required');
    const item = create ? await createBankDraft(body) : await updateBankRegistration(body);
    await logAuditEvent({ userId: auth.id, username: auth.username,
      action: create ? 'BANK_INTEGRATION_CREATED' : 'BANK_INTEGRATION_UPDATED', resourceType: 'bank_integration', resourceId: item.bankCode,
      summary: `${auth.username} ${create ? 'registered' : 'updated'} ${item.bankCode}`, details: item, request });
    return NextResponse.json({ success: true, item }, { status: create ? 201 : 200 });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) { return save(request, true); }
export async function PATCH(request: NextRequest) { return save(request, false); }
function failure(error: unknown) {
  if (!(error instanceof BankRegistryError)) console.error('Bank registry unavailable', error instanceof Error ? error.message : 'Unknown failure');
  return NextResponse.json({ success: false, error: error instanceof BankRegistryError ? error.message : 'Bank registry unavailable. Check the portal MySQL migration and server log.' }, { status: error instanceof BankRegistryError ? error.status : 503 });
}
