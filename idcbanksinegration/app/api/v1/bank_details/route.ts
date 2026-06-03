

//pull bank details from mssql database
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken } from '../../auth/login/middleware/auth';
import { Venbank } from '../../../models/sage_entities/Venbank';
import { Op } from 'sequelize';
import { connectSageDatabase } from '../../../lib/sageDb';

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

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get('session')?.value;
  const user = await verifySessionToken(sessionToken);
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectSageDatabase();
  
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '10');
  const cursor = searchParams.get('cursor'); // Last ID from previous request
  const vendorId = searchParams.get('vendorId');
  
  // Build where clause
  const where: any = {};
  
  if (vendorId) {
    where.vendorid = vendorId;
  }
  
  if (cursor) {
    where.id = { [Op.gt]: parseInt(cursor) };
  }
  
  const banks = await Venbank.findAll({
    where,
    limit: limit + 1, // Fetch one extra to check if there's more
    order: [['id', 'ASC']],
  });
  
  const normalizedBanks = banks.map(normalizeVenbank);
  const hasNextPage = normalizedBanks.length > limit;
  const data = hasNextPage ? normalizedBanks.slice(0, -1) : normalizedBanks;
  const nextCursor = hasNextPage ? data[data.length - 1]?.id : null;
  
  return NextResponse.json({
    success: true,
    data: data,
    pagination: {
      limit: limit,
      nextCursor: nextCursor,
      hasNextPage: hasNextPage,
    },
  });
}

//create
export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get('session')?.value;
  const user = await verifySessionToken(sessionToken);
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    await connectSageDatabase();
    const body = await request.json();
    
    // Validate required fields
    if (!body.vendorid || !body.accname) {
      return NextResponse.json(
        { error: 'Vendor ID and Account Name are required' },
        { status: 400 }
      );
    }
    
    const bank = await Venbank.create(body);
    return NextResponse.json(normalizeVenbank(bank), { status: 201 });
  } catch (error: any) {
    console.error('Error creating bank record:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create bank record' },
      { status: 500 }
    );
  }
}