// app/api/bank_details/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { isAuthError, requirePermission } from '@/app/lib/rbac';
import { PERMISSIONS } from '@/app/lib/permissions';
import { logAuditEvent } from '@/app/lib/auditLog';
import { connectVendorBankDatabase } from '@/app/lib/vendorBankStore';
import { VendorBankDetail as Venbank } from '@/app/models/internal/VendorBankDetail';
import { validateVendorSwiftDetails } from '@/app/lib/vendorSwiftValidation';
import { normalizeVendorBankRecord } from '@/app/lib/vendorBankRead';

function normalizeVenbank(bank: any) {
  return normalizeVendorBankRecord(bank);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, PERMISSIONS.BANK_DETAILS_WRITE);
  if (isAuthError(auth)) return auth;
  
  try {
    await connectVendorBankDatabase();
    const { id } = await params;
    if (!/^portal-[1-9]\d*$/.test(id)) return NextResponse.json({ error: 'Refresh Vendor Bank Details before editing. This request uses a legacy Sage record ID.' }, { status: 409 });
    const bank = await Venbank.findByPk(id.slice(7));
    if (!bank) {
      return NextResponse.json({ error: 'Bank record not found' }, { status: 404 });
    }
    
    const body = await request.json();
    if (body?.vendorid !== undefined && body.vendorid !== bank.vendorid) return NextResponse.json({ error: 'The vendor on this record has changed. Refresh Vendor Bank Details.' }, { status: 409 });
    const errors = validateVendorSwiftDetails(body);
    if (errors.length) return NextResponse.json({ error: errors.join('; ') }, { status: 400 });
    for (const field of ['tpin', 'purposeCode', 'sectorCode']) {
      if (body[field] !== undefined) body[field] = body[field]?.trim() || null;
    }
    const fields = ['vendorid', 'accven', 'accname', 'bankid', 'sortcde', 'brnch', 'swiftcde', 'tpin', 'purposeCode', 'sectorCode', 'physicalAddress', 'countryOfOrigin', 'email', 'phoneNumber'];
    await bank.update(Object.fromEntries(Object.entries(body).filter(([key]) => fields.includes(key))));
    
    // Fetch updated record
    const updatedBank = await Venbank.findByPk(id.slice(7));

    await logAuditEvent({
      userId: auth.id,
      username: auth.username,
      action: 'BANK_DETAILS_UPDATED',
      resourceType: 'vendor_bank',
      resourceId: String(id),
      summary: `${auth.username} updated bank details #${id} (vendor ${bank.vendorid})`,
      details: { bankId: id, vendorId: bank.vendorid, changes: body },
      request,
    });

    return NextResponse.json(normalizeVenbank(updatedBank));
  } catch (error: any) {
    console.error('Error updating bank record:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update bank record' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, PERMISSIONS.BANK_DETAILS_WRITE);
  if (isAuthError(auth)) return auth;
  
  try {
    await connectVendorBankDatabase();
    const { id } = await params;
    if (!/^portal-[1-9]\d*$/.test(id)) return NextResponse.json({ error: 'Refresh Vendor Bank Details before deleting. This request uses a legacy Sage record ID.' }, { status: 409 });
    const bank = await Venbank.findByPk(id.slice(7));
    if (!bank) {
      return NextResponse.json({ error: 'Bank record not found' }, { status: 404 });
    }

    const vendorId = bank.vendorid;
    await bank.destroy();

    await logAuditEvent({
      userId: auth.id,
      username: auth.username,
      action: 'BANK_DETAILS_DELETED',
      resourceType: 'vendor_bank',
      resourceId: String(id),
      summary: `${auth.username} deleted bank details #${id} (vendor ${vendorId})`,
      details: { bankId: id, vendorId },
      request,
    });

    return NextResponse.json({ message: 'Deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting bank record:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete bank record' },
      { status: 500 }
    );
  }
}
