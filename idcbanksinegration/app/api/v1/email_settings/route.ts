import { NextRequest, NextResponse } from 'next/server';
import { Op } from 'sequelize';
import { clearSessionCookieOptions } from '@/app/lib/sessionCookie';
import { logAuditEvent } from '@/app/lib/auditLog';
import { encryptSmtpPassword, hasSmtpEncryptionKey, normalizeEmail, sendLoginEmail, type SmtpConfiguration } from '@/app/lib/loginSmtp';
import { PERMISSIONS } from '@/app/lib/permissions';
import { isAuthError, requirePermission } from '@/app/lib/rbac';
import { LoginSmtpSettings } from '@/app/models/internal/LoginOtp';
import { User } from '@/app/models/internal/User';

export async function GET(request: NextRequest) {
  const admin = await requirePermission(request, PERMISSIONS.USERS_MANAGE);
  if (isAuthError(admin)) return admin;

  const settings = await LoginSmtpSettings.findByPk(1);
  const configuration = settings ? JSON.parse(settings.configuration) as SmtpConfiguration : null;
  return NextResponse.json({
    enabled: settings?.enabled ?? false,
    configuration: configuration && {
      host: configuration.host, port: configuration.port, mode: configuration.mode,
      username: configuration.username, sender: configuration.sender,
    },
  });
}

export async function POST(request: NextRequest) {
  const admin = await requirePermission(request, PERMISSIONS.USERS_MANAGE);
  if (isAuthError(admin)) return admin;

  if (!hasSmtpEncryptionKey()) {
    return NextResponse.json({ error: 'Configure SMTP_ENCRYPTION_KEY on the portal server first.' }, { status: 503 });
  }
  const body = await request.json().catch(() => null);
  const action = body?.action;
  const host = String(body?.host ?? '').trim();
  const port = Number(body?.port);
  const mode = body?.mode;
  const username = String(body?.username ?? '').trim();
  const password = String(body?.password ?? '');
  const sender = normalizeEmail(body?.sender);
  if (!['test', 'save', 'activate'].includes(action) || !/^[a-z\d][a-z\d.-]{0,252}$/i.test(host)
    || !Number.isInteger(port) || port < 1 || port > 65535 || !sender
    || !['tls', 'starttls'].includes(mode) || username.length > 254 || password.length > 1024) {
    return NextResponse.json({ error: 'Enter valid SMTP settings.' }, { status: 400 });
  }

  const [settings, user] = await Promise.all([LoginSmtpSettings.findByPk(1), User.findByPk(admin.id)]);
  if (!user?.email) return NextResponse.json({ error: 'Add an email to your admin account first.' }, { status: 400 });
  if (action === 'activate' && await User.count({ where: { isActive: true, email: { [Op.is]: null } } })) {
    return NextResponse.json({ error: 'Add email addresses to all active accounts before enabling OTP.' }, { status: 409 });
  }

  const previous = settings ? JSON.parse(settings.configuration) as SmtpConfiguration : null;
  if (username && !password && (!previous || previous.username !== username || previous.host !== host)) {
    return NextResponse.json({ error: 'Enter the SMTP password for this account.' }, { status: 400 });
  }
  const configuration: SmtpConfiguration = {
    host, port, mode, username, sender,
    password: username && !password && previous ? previous.password : encryptSmtpPassword(password),
  };
  try {
    await sendLoginEmail(configuration, user.email, 'Infratel portal SMTP test', 'The portal can send email using these settings.');
  } catch {
    return NextResponse.json({ error: 'SMTP delivery failed. Check your connection and credentials.' }, { status: 422 });
  }

  if (action !== 'test') {
    const values = { configuration: JSON.stringify(configuration) };
    if (settings) await settings.update(action === 'activate' ? { ...values, enabled: true } : values);
    else await LoginSmtpSettings.create({ id: 1, ...values, enabled: action === 'activate' });
    await logAuditEvent({
      userId: admin.id, username: admin.username, action: action === 'activate' ? 'LOGIN_OTP_ENABLED' : 'LOGIN_SMTP_UPDATED',
      resourceType: 'auth', summary: 'An administrator updated email sign-in settings.', request,
    });
  }

  const response = NextResponse.json({ success: true, enabled: action === 'activate' || settings?.enabled === true });
  if (action === 'activate') response.cookies.set('session', '', clearSessionCookieOptions());
  return response;
}
