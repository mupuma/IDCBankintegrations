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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission(request, PERMISSIONS.USERS_MANAGE);
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  await connectDatabase();

  const user = await User.findByPk(id);
  if (!user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  const body = await request.json();
  const changes: Record<string, unknown> = {};

  if (body?.role !== undefined) {
    const role = normalizeRole(body.role);
    if (!Object.values(ROLES).includes(role)) {
      return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
    }
    user.role = role;
    changes.role = role;
  }

  if (body?.password !== undefined && String(body.password).length > 0) {
    user.password = String(body.password);
    changes.passwordReset = true;
  }

  if (body?.isActive !== undefined) {
    const isActive = Boolean(body.isActive);
    if (user.id === auth.id && !isActive) {
      return NextResponse.json(
        { error: 'You cannot deactivate your own account.' },
        { status: 400 },
      );
    }
    user.isActive = isActive;
    changes.isActive = isActive;
  }

  await user.save();

  await logAuditEvent({
    userId: auth.id,
    username: auth.username,
    action: 'USER_UPDATED',
    resourceType: 'user',
    resourceId: String(user.id),
    summary: `${auth.username} updated user ${user.username}`,
    details: { targetUserId: user.id, targetUsername: user.username, changes },
    request,
  });

  return NextResponse.json({ success: true, user: serializeUser(user) });
}

// export async function DELETE(
//   request: NextRequest,
//   { params }: { params: Promise<{ id: string }> },
// ) {
//   const auth = await requirePermission(request, PERMISSIONS.USERS_MANAGE);
//   if (isAuthError(auth)) return auth;

//   const { id } = await params;
//   const targetId = Number(id);

//   if (targetId === auth.id) {
//     return NextResponse.json(
//       { error: 'You cannot delete your own account.' },
//       { status: 400 },
//     );
//   }

//   await connectDatabase();

//   const user = await User.findByPk(id);
//   if (!user) {
//     return NextResponse.json({ error: 'User not found.' }, { status: 404 });
//   }

//   const username = user.username;
//   await user.destroy();

//   await logAuditEvent({
//     userId: auth.id,
//     username: auth.username,
//     action: 'USER_DELETED',
//     resourceType: 'user',
//     resourceId: String(id),
//     summary: `${auth.username} deleted user ${username}`,
//     details: { targetUserId: targetId, targetUsername: username },
//     request,
//   });

//   return NextResponse.json({ success: true });
// }
