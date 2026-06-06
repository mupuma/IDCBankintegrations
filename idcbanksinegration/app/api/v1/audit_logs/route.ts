import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Op, type WhereOptions } from 'sequelize';
import { connectDatabase } from '@/app/lib/db';
import { PERMISSIONS } from '@/app/lib/permissions';
import { isAuthError, requirePermission } from '@/app/lib/rbac';
import { AuditLog } from '@/app/models/internal/AuditLog';

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, PERMISSIONS.AUDIT_READ);
  if (isAuthError(auth)) return auth;

  await connectDatabase();

  const params = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(params.get('page') || '1', 10));
  const pageSize = Math.max(1, Math.min(100, parseInt(params.get('pageSize') || '25', 10)));
  const action = params.get('action');
  const username = params.get('username');
  const resourceType = params.get('resourceType');
  const search = params.get('search');

  const where: WhereOptions = {
    ...(action ? { action } : {}),
    ...(username ? { username } : {}),
    ...(resourceType ? { resourceType } : {}),
    ...(search
      ? {
          [Op.or]: [
            { summary: { [Op.like]: `%${search}%` } },
            { resourceId: { [Op.like]: `%${search}%` } },
            { username: { [Op.like]: `%${search}%` } },
          ],
        }
      : {}),
  };

  const { rows, count } = await AuditLog.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const logs = rows.map((row) => {
    let details: unknown = null;
    if (row.details) {
      try {
        details = JSON.parse(row.details);
      } catch {
        details = row.details;
      }
    }

    return {
      id: row.id,
      userId: row.userId,
      username: row.username,
      action: row.action,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      summary: row.summary,
      details,
      ipAddress: row.ipAddress,
      createdAt: row.createdAt,
    };
  });

  const actions = await AuditLog.findAll({
    attributes: ['action'],
    group: ['action'],
    order: [['action', 'ASC']],
  });

  return NextResponse.json({
    success: true,
    logs,
    total: count,
    page,
    pageSize,
    actions: actions.map((row) => row.action),
  });
}
