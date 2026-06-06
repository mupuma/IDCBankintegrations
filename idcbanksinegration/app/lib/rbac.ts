import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken } from '../api/auth/login/middleware/auth';
import { connectDatabase } from './db';
import { logAuditEvent } from './auditLog';
import { User } from '../models/internal/User';
import {
  getPermissionsForRole,
  roleHasPermission,
  type Permission,
} from './permissions';

export interface SessionUser {
  id: number;
  username: string;
  role: string;
  permissions: Permission[];
}

export async function getSessionUser(request: NextRequest): Promise<SessionUser | null> {
  const token = request.cookies.get('session')?.value;
  const payload = await verifySessionToken(token);
  if (!payload?.sub || !payload?.username) return null;

  await connectDatabase();
  const user = await User.findByPk(Number(payload.sub));
  if (!user || user.isActive === false) return null;

  const role = user.role ?? payload.role ?? 'OPERATOR';

  return {
    id: user.id,
    username: user.username,
    role,
    permissions: getPermissionsForRole(role),
  };
}

export async function requireAuth(
  request: NextRequest,
): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return user;
}

export async function requirePermission(
  request: NextRequest,
  permission: Permission,
): Promise<SessionUser | NextResponse> {
  const result = await requireAuth(request);
  if (result instanceof NextResponse) return result;

  if (!roleHasPermission(result.role, permission)) {
    void logAuditEvent({
      userId: result.id,
      username: result.username,
      action: 'ACCESS_DENIED',
      resourceType: 'permission',
      resourceId: permission,
      summary: `${result.username} denied access to ${permission}`,
      request,
    });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return result;
}

export function isAuthError(value: SessionUser | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
