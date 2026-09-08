import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logAuditEvent } from '@/app/lib/auditLog';

const AGENT_AUDIT_API_KEY = process.env.AGENT_AUDIT_API_KEY || null;

export async function POST(request: NextRequest) {
  const providedApiKey = request.headers.get('x-agent-audit-key');
  if (!AGENT_AUDIT_API_KEY || providedApiKey !== AGENT_AUDIT_API_KEY) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const action = String(body?.action ?? '').trim();
    if (!action) {
      return NextResponse.json({ success: false, error: 'action is required' }, { status: 400 });
    }

    await logAuditEvent({
      userId: body?.userId ?? null,
      username: body?.username ?? 'agent-service',
      action: action as any,
      resourceType: body?.resourceType ?? 'agent_event',
      resourceId: body?.resourceId ?? null,
      correlationId: body?.correlationId ?? body?.queueId ?? body?.paymentId ?? null,
      summary: String(body?.summary ?? `Agent audit event ${action}`),
      details: body?.details ?? null,
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message ?? 'Invalid request' }, { status: 500 });
  }
}
