// app/api/bank_details/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { isAuthError, requirePermission } from '@/app/lib/rbac';
import { PERMISSIONS } from '@/app/lib/permissions';
import { logAuditEvent } from '@/app/lib/auditLog';
import { connectSageDatabase } from '@/app/lib/sageDb';
import { Venbank } from '@/app/models/sage_entities/Venbank';

function normalizeVenbank(bank: any) {
  const record = bank.toJSON ? bank.toJSON() : bank;
  const physicalAddress = record.physicalAddress;

  return {
    ...record,
    physicalAddress:
      typeof physicalAddress === 'string' && physicalAddress
        ? JSON.parse(physicalAddress)
        : physicalAddress || null,
  };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, PERMISSIONS.BANK_DETAILS_WRITE);
  if (isAuthError(auth)) return auth;
  
  try {
    await connectSageDatabase();
    const { id } = await params;
    const bank = await Venbank.findByPk(id);
    if (!bank) {
      return NextResponse.json({ error: 'Bank record not found' }, { status: 404 });
    }
    
    const body = await request.json();
    await bank.update(body);
    
    // Fetch updated record
    const updatedBank = await Venbank.findByPk(id);

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
    await connectSageDatabase();
    const { id } = await params;
    const bank = await Venbank.findByPk(id);
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