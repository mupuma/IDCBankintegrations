import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { clearSessionCookieOptions } from '@/app/lib/sessionCookie';
import { logAuditEvent } from '@/app/lib/auditLog';
import { getSessionUser } from '@/app/lib/rbac';

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);

  if (user) {
    await logAuditEvent({
      userId: user.id,
      username: user.username,
      action: 'LOGOUT',
      resourceType: 'auth',
      resourceId: String(user.id),
      summary: `${user.username} logged out`,
      request,
    });
  }

  const response = NextResponse.json({ success: true, message: 'Logged out' });
  response.cookies.set('session', '', clearSessionCookieOptions());
  return response;
}
