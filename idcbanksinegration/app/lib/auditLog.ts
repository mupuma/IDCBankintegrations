import type { NextRequest } from 'next/server';
import type { AuditAction } from '../models/internal/AuditLog';
import { AuditLog } from '../models/internal/AuditLog';
import { connectDatabase } from './db';

export interface AuditEventInput {
  userId?: number | string | null;
  username?: string | null;
  action: AuditAction;
  resourceType?: string | null;
  resourceId?: string | null;
  summary: string;
  details?: Record<string, unknown> | null;
  request?: NextRequest | null;
}

export function getClientIp(request?: NextRequest | null): string | null {
  if (!request) return null;
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? null;
  return request.headers.get('x-real-ip');
}

export function getUserAgent(request?: NextRequest | null): string | null {
  if (!request) return null;
  const value = request.headers.get('user-agent');
  return value ? value.slice(0, 500) : null;
}

export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    await connectDatabase();

    const userId =
      input.userId === undefined || input.userId === null
        ? null
        : Number(input.userId);

    await AuditLog.create({
      userId: Number.isFinite(userId) ? userId : null,
      username: input.username ?? null,
      action: input.action,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ? String(input.resourceId) : null,
      summary: input.summary.slice(0, 500),
      details: input.details ? JSON.stringify(input.details) : null,
      ipAddress: getClientIp(input.request),
      userAgent: getUserAgent(input.request),
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}
