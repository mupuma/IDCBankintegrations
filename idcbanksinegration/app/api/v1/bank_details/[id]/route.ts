// app/api/bank_details/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/app/api/auth/login/middleware/auth';
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
  const sessionToken = request.cookies.get('session')?.value;
  const user = await verifySessionToken(sessionToken);
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
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
  const sessionToken = request.cookies.get('session')?.value;
  const user = await verifySessionToken(sessionToken);
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    await connectSageDatabase();
    const { id } = await params;
    const bank = await Venbank.findByPk(id);
    if (!bank) {
      return NextResponse.json({ error: 'Bank record not found' }, { status: 404 });
    }
    
    await bank.destroy();
    return NextResponse.json({ message: 'Deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting bank record:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete bank record' },
      { status: 500 }
    );
  }
}