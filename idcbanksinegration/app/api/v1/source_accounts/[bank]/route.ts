import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { connectDatabase } from '@/app/lib/db';
import { logAuditEvent } from '@/app/lib/auditLog';
import { PERMISSIONS } from '@/app/lib/permissions';
import { isAuthError, requirePermission } from '@/app/lib/rbac';
import { listSourceBanks, resolveSourceBank, serializeSourceAccount } from '@/app/lib/sourceAccounts';
import { SourceAccount } from '@/app/models/internal/SourceAccount';

function normalizeBankCode(value: string) {
  return decodeURIComponent(value).trim().toUpperCase();
}

function normalizeOptionalString(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bank: string }> },
) {
  const auth = await requirePermission(request, PERMISSIONS.BANK_DETAILS_READ);
  if (isAuthError(auth)) return auth;

  const bank = normalizeBankCode((await params).bank);
  const merged = await resolveSourceBank(bank);

  if (!merged) {
    return NextResponse.json({ success: false, error: 'Source account not found.' }, { status: 404 });
  }

  await connectDatabase();
  const local = await SourceAccount.findOne({ where: { bank } });

  return NextResponse.json({
    success: true,
    merged,
    local: local ? serializeSourceAccount(local) : null,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ bank: string }> },
) {
  const auth = await requirePermission(request, PERMISSIONS.BANK_DETAILS_WRITE);
  if (isAuthError(auth)) return auth;

  const bank = normalizeBankCode((await params).bank);
  const body = await request.json();

  await connectDatabase();

  let row = await SourceAccount.findOne({ where: { bank } });
  if (!row) {
    row = await SourceAccount.create({
      bank,
      name: normalizeOptionalString(body?.name),
      accountNumber: normalizeOptionalString(body?.accountNumber),
      branchCode: normalizeOptionalString(body?.branchCode),
      contact: normalizeOptionalString(body?.contact),
      phone: normalizeOptionalString(body?.phone),
      notes: normalizeOptionalString(body?.notes),
      isActive: body?.isActive !== false,
    });
  } else {
    await row.update({
      name: normalizeOptionalString(body?.name),
      accountNumber: normalizeOptionalString(body?.accountNumber),
      branchCode: normalizeOptionalString(body?.branchCode),
      contact: normalizeOptionalString(body?.contact),
      phone: normalizeOptionalString(body?.phone),
      notes: normalizeOptionalString(body?.notes),
      isActive: body?.isActive !== false,
    });
  }

  await logAuditEvent({
    userId: auth.id,
    username: auth.username,
    action: 'SOURCE_ACCOUNT_UPDATED',
    resourceType: 'source_account',
    resourceId: bank,
    summary: `${auth.username} updated source account details for ${bank}`,
    details: { bank },
    request,
  });

  const merged = (await listSourceBanks()).find((item) => item.bank.toUpperCase() === bank);

  return NextResponse.json({
    success: true,
    item: serializeSourceAccount(row),
    merged,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ bank: string }> },
) {
  const auth = await requirePermission(request, PERMISSIONS.BANK_DETAILS_WRITE);
  if (isAuthError(auth)) return auth;

  const bank = normalizeBankCode((await params).bank);

  await connectDatabase();
  const row = await SourceAccount.findOne({ where: { bank } });

  if (!row) {
    return NextResponse.json({ success: false, error: 'Local source account not found.' }, { status: 404 });
  }

  await row.destroy();

  await logAuditEvent({
    userId: auth.id,
    username: auth.username,
    action: 'SOURCE_ACCOUNT_DELETED',
    resourceType: 'source_account',
    resourceId: bank,
    summary: `${auth.username} removed local source account details for ${bank}`,
    details: { bank },
    request,
  });

  return NextResponse.json({ success: true });
}
