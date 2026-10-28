import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, isAuthError } from '@/app/lib/rbac';
import { PERMISSIONS } from '@/app/lib/permissions';
import { readAgentProfile, saveAgentProfile } from '@/app/lib/agentOnboarding';
import { BankRegistryError } from '@/app/lib/bankRegistry';
import { logAuditEvent } from '@/app/lib/auditLog';

const headers = { 'Cache-Control': 'no-store' };
function failure(error: unknown) {
  // Never log ORM errors here: they can contain encrypted columns or input parameters.
  return NextResponse.json({ error: error instanceof BankRegistryError ? error.message : 'Agent settings unavailable. Check the portal MySQL migration and encryption key.' }, { status: error instanceof BankRegistryError ? error.status : 503, headers });
}
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, PERMISSIONS.BANK_INTEGRATIONS_MANAGE);
  if (isAuthError(auth)) return auth;
  try { return NextResponse.json(await readAgentProfile(request.nextUrl.searchParams.get('bankCode') || ''), { headers }); }
  catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, PERMISSIONS.BANK_INTEGRATIONS_MANAGE);
  if (isAuthError(auth)) return auth;
  try {
    const raw = await request.text();
    if (raw.length > 65536) throw new BankRegistryError('Agent settings request is too large.', 413);
    let body;
    try { body = JSON.parse(raw); } catch { throw new BankRegistryError('Invalid JSON.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BankRegistryError('Agent settings must be an object.');
    const item = await saveAgentProfile(body);
    await logAuditEvent({ userId: auth.id, username: auth.username, action: 'BANK_INTEGRATION_UPDATED',
      resourceType: 'bank_integration', resourceId: body.bankCode, summary: `${auth.username} ${body.action === 'discover' ? 'discovered an agent for' : 'configured an agent for'} ${body.bankCode}`,
      details: { action: body.action, revision: item.revision }, request });
    return NextResponse.json(item, { headers });
  } catch (error) { return failure(error); }
}
