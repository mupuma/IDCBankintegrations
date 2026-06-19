import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { connectDatabase } from '@/app/lib/db';
import { logAuditEvent } from '@/app/lib/auditLog';
import { PERMISSIONS } from '@/app/lib/permissions';
import { isAuthError, requirePermission } from '@/app/lib/rbac';
import { listSourceBanks, serializeSourceAccount } from '@/app/lib/sourceAccounts';
import { SourceAccount } from '@/app/models/internal/SourceAccount';

function normalizeBankCode(value: unknown) {
  return String(value ?? '').trim().toUpperCase();
}

function normalizeOptionalString(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, PERMISSIONS.BANK_DETAILS_READ);
  if (isAuthError(auth)) return auth;

  await connectDatabase();
  const rows = await SourceAccount.findAll({ order: [['bank', 'ASC']] });

  return NextResponse.json({
    success: true,
    items: rows.map(serializeSourceAccount),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, PERMISSIONS.BANK_DETAILS_WRITE);
  if (isAuthError(auth)) return auth;

  const body = await request.json();
  const bank = normalizeBankCode(body?.bank);

  if (!bank) {
    return NextResponse.json({ success: false, error: 'Bank code is required.' }, { status: 400 });
  }

  await connectDatabase();

  const existing = await SourceAccount.findOne({ where: { bank } });
  if (existing) {
    return NextResponse.json(
      { success: false, error: `Source account for bank "${bank}" already exists. Use update instead.` },
      { status: 409 },
    );
  }

  const row = await SourceAccount.create({
    bank,
    name: normalizeOptionalString(body?.name),
    accountNumber: normalizeOptionalString(body?.accountNumber),
    branchCode: normalizeOptionalString(body?.branchCode),
    contact: normalizeOptionalString(body?.contact),
    phone: normalizeOptionalString(body?.phone),
    notes: normalizeOptionalString(body?.notes),
    isActive: body?.isActive !== false,
  });

  await logAuditEvent({
    userId: auth.id,
    username: auth.username,
    action: 'SOURCE_ACCOUNT_CREATED',
    resourceType: 'source_account',
    resourceId: bank,
    summary: `${auth.username} created source account details for ${bank}`,
    details: { bank },
    request,
  });

  const merged = (await listSourceBanks()).find((item) => item.bank.toUpperCase() === bank);

  return NextResponse.json(
    {
      success: true,
      item: serializeSourceAccount(row),
      merged,
    },
    { status: 201 },
  );
}
