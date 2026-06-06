import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { encrypt } from '../../../lib/auth';
import { sessionCookieOptions } from '../../../lib/sessionCookie';
import { User } from '../../../models/internal/User';
import { ensureDefaultAdmin } from '../../../lib/initDefaultAdmin';
import { logAuditEvent } from '../../../lib/auditLog';
import { connectDatabase } from '../../../lib/db';

export async function POST(request: NextRequest) {
  await ensureDefaultAdmin();
  await connectDatabase();

  const body = await request.json();
  const username = String(body?.username ?? '').trim();
  const password = String(body?.password ?? '');

  if (!username || !password) {
    return NextResponse.json(
      { error: 'Username and password are required.' },
      { status: 400 }
    );
  }

  const user = await User.findOne({ where: { username } });

  if (!user || user.isActive === false || !(await user.validatePassword(password))) {
    await logAuditEvent({
      username,
      action: 'LOGIN_FAILED',
      resourceType: 'auth',
      summary: `Failed login attempt for ${username}`,
      request,
    });
    return NextResponse.json(
      { error: 'Invalid username or password.' },
      { status: 401 }
    );
  }

  const token = await encrypt({
    sub: String(user.id),
    username: user.username,
    role: user.role,
  });

  await logAuditEvent({
    userId: user.id,
    username: user.username,
    action: 'LOGIN',
    resourceType: 'auth',
    resourceId: String(user.id),
    summary: `${user.username} logged in`,
    request,
  });

  const response = NextResponse.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  });

  response.cookies.set('session', token, sessionCookieOptions(60 * 60));

  return response;
}
