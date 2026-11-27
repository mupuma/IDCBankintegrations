import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { encrypt, getSessionMaxAgeSeconds } from '../../../lib/auth';
import { sessionCookieOptions } from '../../../lib/sessionCookie';
import { User } from '../../../models/internal/User';
import { ensureDefaultAdmin } from '../../../lib/initDefaultAdmin';
import { logAuditEvent } from '../../../lib/auditLog';
import { connectDatabase } from '../../../lib/db';

import { LoginSmtpSettings } from '../../../models/internal/LoginOtp';
import { issueLoginOtp, verifyLoginOtp } from '../../../lib/loginOtp';
import type { SmtpConfiguration } from '../../../lib/loginSmtp';

export async function POST(request: NextRequest) {
  await ensureDefaultAdmin();
  await connectDatabase();

  const body = await request.json();
  const username = String(body?.username ?? '').trim();
  const password = String(body?.password ?? '');

  const settings = await LoginSmtpSettings.findByPk(1);
  if (settings?.enabled && typeof body?.challengeId === 'string') {
    const code = typeof body.code === 'string' ? body.code : '';
    const user = /^\d{6}$/.test(code) && username
      ? await verifyLoginOtp(username, body.challengeId, code) : null;
    if (!user) return NextResponse.json({ error: 'Invalid or expired code. Request a new code if needed.' }, { status: 401 });
    return completeLogin(user, request, true);
  }

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

  if (settings?.enabled) {
    if (!user.email) return NextResponse.json({ error: 'Ask an administrator to add your email address.' }, { status: 403 });
    try {
      const challengeId = await issueLoginOtp(user, JSON.parse(settings.configuration) as SmtpConfiguration);
      if (!challengeId) return NextResponse.json({ error: 'Wait one minute before requesting another code.' }, { status: 429 });
      return NextResponse.json({ challengeId });
    } catch {
      return NextResponse.json({ error: 'The sign-in email could not be sent. Try again shortly or contact your administrator.' }, { status: 503 });
    }
  }

  return completeLogin(user, request, false);
}

async function completeLogin(user: User, request: NextRequest, emailOtp: boolean) {
  const token = await encrypt({
    emailOtp,
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

  response.cookies.set('session', token, sessionCookieOptions(getSessionMaxAgeSeconds()));

  return response;
}
