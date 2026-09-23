import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, isAuthError } from '@/app/lib/rbac';
import { PERMISSIONS } from '@/app/lib/permissions';
import { h2hEnabled } from '@/app/lib/zicb/config';

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, PERMISSIONS.PAYMENTS_READ);
  if (isAuthError(auth)) return auth;
  const enabled = h2hEnabled();
  try {
    const raw = enabled ? JSON.parse(process.env.ZICB_H2H_SOURCE_PROFILES || '{}') : {};
    if (enabled && !Object.keys(raw).length && process.env.ZICB_H2H_PROFILE_ID) {
      raw.DEFAULT = {
        amountScale: Number(process.env.ZICB_H2H_AMOUNT_SCALE || 2),
      };
    }
    const profiles = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, { amountScale: (value as any).amountScale }]));
    return NextResponse.json({ enabled, profiles });
  } catch { return NextResponse.json({ error: 'H2H profile configuration is invalid' }, { status: 503 }); }
}
