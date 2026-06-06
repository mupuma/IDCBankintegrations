import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { connectDatabase } from '@/app/lib/db';
import { logAuditEvent } from '@/app/lib/auditLog';
import { PERMISSIONS, ROLES, ROLE_LABELS, normalizeRole } from '@/app/lib/permissions';
import { isAuthError, requirePermission } from '@/app/lib/rbac';
import { User } from '@/app/models/internal/User';

function serializeUser(user: User) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    roleLabel: ROLE_LABELS[normalizeRole(user.role)],
    isActive: user.isActive !== false,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, PERMISSIONS.USERS_MANAGE);
  if (isAuthError(auth)) return auth;

  await connectDatabase();
  const users = await User.findAll({ order: [['username', 'ASC']] });

  return NextResponse.json({
    success: true,
    users: users.map(serializeUser),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, PERMISSIONS.USERS_MANAGE);
  if (isAuthError(auth)) return auth;

  const body = await request.json();
  const username = String(body?.username ?? '').trim();
  const password = String(body?.password ?? '');
  const role = normalizeRole(body?.role);

  if (!username || !password) {
    return NextResponse.json(
      { error: 'Username and password are required.' },
      { status: 400 },
    );
  }

  if (!Object.values(ROLES).includes(role)) {
    return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
  }

  await connectDatabase();

  const existing = await User.findOne({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: 'Username already exists.' }, { status: 409 });
  }

  const user = await User.create({
    username,
    password,
    role,
    isActive: true,
  });

  await logAuditEvent({
    userId: auth.id,
    username: auth.username,
    action: 'USER_CREATED',
    resourceType: 'user',
    resourceId: String(user.id),
    summary: `${auth.username} created user ${user.username} (${role})`,
    details: { targetUserId: user.id, targetUsername: user.username, role },
    request,
  });

  return NextResponse.json({ success: true, user: serializeUser(user) }, { status: 201 });
}
