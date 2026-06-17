

// //pull bank details from mssql database
// import { NextResponse } from 'next/server';
// import type { NextRequest } from 'next/server';
// import { isAuthError, requirePermission } from '../../../lib/rbac';
// import { PERMISSIONS } from '../../../lib/permissions';
// import { logAuditEvent } from '../../../lib/auditLog';
// import { Venbank } from '../../../models/sage_entities/Venbank';
// import { Op } from 'sequelize';
// import { connectSageDatabase } from '../../../lib/sageDb';

// function normalizeVenbank(bank: any) {
//   const record = bank.toJSON ? bank.toJSON() : bank;
//   const physicalAddress = record.physicalAddress;

//   return {
//     ...record,
//     physicalAddress:
//       typeof physicalAddress === 'string' && physicalAddress
//         ? JSON.parse(physicalAddress)
//         : physicalAddress || null,
//   };
// }

// export async function GET(request: NextRequest) {
//   const auth = await requirePermission(request, PERMISSIONS.BANK_DETAILS_READ);
//   if (isAuthError(auth)) return auth;

//   await connectSageDatabase();
  
//   const searchParams = request.nextUrl.searchParams;
//   const limit = parseInt(searchParams.get('limit') || '10');
//   const cursor = searchParams.get('cursor'); // Last ID from previous request
//   const vendorId = searchParams.get('vendorId');
  
//   // Build where clause
//   const where: any = {};
  
//   if (vendorId) {
//     where.vendorid = vendorId;
//   }
  
//   if (cursor) {
//     where.id = { [Op.gt]: parseInt(cursor) };
//   }
  
//   const banks = await Venbank.findAll({
//     where,
//     limit: limit + 1, // Fetch one extra to check if there's more
//     order: [['id', 'ASC']],
//   });
  
//   const normalizedBanks = banks.map(normalizeVenbank);
//   const hasNextPage = normalizedBanks.length > limit;
//   const data = hasNextPage ? normalizedBanks.slice(0, -1) : normalizedBanks;
//   const nextCursor = hasNextPage ? data[data.length - 1]?.id : null;
  
//   return NextResponse.json({
//     success: true,
//     data: data,
//     pagination: {
//       limit: limit,
//       nextCursor: nextCursor,
//       hasNextPage: hasNextPage,
//     },
//   });
// }

// //create
// export async function POST(request: NextRequest) {
//   const auth = await requirePermission(request, PERMISSIONS.BANK_DETAILS_WRITE);
//   if (isAuthError(auth)) return auth;
  
//   try {
//     await connectSageDatabase();
//     const body = await request.json();
    
//     // Validate required fields
//     if (!body.vendorid || !body.accname) {
//       return NextResponse.json(
//         { error: 'Vendor ID and Account Name are required' },
//         { status: 400 }
//       );
//     }
    
//     const bank = await Venbank.create(body);

//     await logAuditEvent({
//       userId: auth.id,
//       username: auth.username,
//       action: 'BANK_DETAILS_CREATED',
//       resourceType: 'vendor_bank',
//       resourceId: String(bank.id),
//       summary: `${auth.username} created bank details for vendor ${body.vendorid}`,
//       details: {
//         vendorId: body.vendorid,
//         accountName: body.accname,
//         bankId: bank.id,
//       },
//       request,
//     });

//     return NextResponse.json(normalizeVenbank(bank), { status: 201 });
//   } catch (error: any) {
//     console.error('Error creating bank record:', error);
//     return NextResponse.json(
//       { error: error.message || 'Failed to create bank record' },
//       { status: 500 }
//     );
//   }
// }

//pull bank details from mssql database
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAuthError, requirePermission } from '../../../lib/rbac';
import { PERMISSIONS } from '../../../lib/permissions';
import { logAuditEvent } from '../../../lib/auditLog';
import { Venbank } from '../../../models/sage_entities/Venbank';
import { Op, Sequelize } from 'sequelize';
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
  const auth = await requirePermission(request, PERMISSIONS.BANK_DETAILS_READ);
  if (isAuthError(auth)) return auth;

  await connectSageDatabase();
  
  const searchParams = request.nextUrl.searchParams;
  
  // Get pagination parameters - support both page-based and cursor-based
  const page = parseInt(searchParams.get('page') || '0');
  const limit = parseInt(searchParams.get('limit') || '10');
  const cursor = searchParams.get('cursor'); // Last ID from previous request
  const vendorid = searchParams.get('vendorid') || ''; // Changed from vendorId to vendorid
  const search = searchParams.get('search') || '';
  
  console.log('API Params:', { page, limit, cursor, vendorid, search }); // Debug log

  // Build where clause
  const where: any = {};
  
  // Vendor filter - case insensitive like
  if (vendorid && vendorid.trim()) {
    where.vendorid = { [Op.like]: `%${vendorid.trim()}%` };
  }
  
  // Search functionality - search across multiple fields
  if (search && search.trim()) {
    const searchTerm = `%${search.trim()}%`;
    where[Op.or] = [
      { vendorid: { [Op.like]: searchTerm } },
      { accven: { [Op.like]: searchTerm } },
      { accname: { [Op.like]: searchTerm } },
      { bankid: { [Op.like]: searchTerm } },
      { sortcde: { [Op.like]: searchTerm } },
      { brnch: { [Op.like]: searchTerm } },
      { swiftcde: { [Op.like]: searchTerm } },
      { countryOfOrigin: { [Op.like]: searchTerm } },
      { email: { [Op.like]: searchTerm } },
      { phoneNumber: { [Op.like]: searchTerm } },
      // For JSON field search (PostgreSQL)
      ...(process.env.DB_TYPE === 'postgres' ? [
        Sequelize.literal(`CAST("physicalAddress" AS TEXT) LIKE '${searchTerm}'`)
      ] : [])
    ];
  }
  
  // Cursor-based pagination (if cursor is provided)
  if (cursor) {
    where.id = { [Op.gt]: parseInt(cursor) };
  }
  
  // Determine which pagination method to use
  let banks;
  let totalItems = 0;
  let hasNextPage = false;
  let nextCursor = null;
  
  if (cursor) {
    // Cursor-based pagination (original method)
    banks = await Venbank.findAll({
      where,
      limit: limit + 1, // Fetch one extra to check if there's more
      order: [['id', 'ASC']],
    });
    
    const normalizedBanks = banks.map(normalizeVenbank);
    hasNextPage = normalizedBanks.length > limit;
    const data = hasNextPage ? normalizedBanks.slice(0, -1) : normalizedBanks;
    nextCursor = hasNextPage ? data[data.length - 1]?.id : null;
    
    return NextResponse.json({
      success: true,
      data: data,
      pagination: {
        limit: limit,
        nextCursor: nextCursor,
        hasNextPage: hasNextPage,
        totalItems: data.length,
      },
    });
  } else {
    // Page-based pagination (for your frontend)
    const offset = page * limit;
    
    // Get total count for pagination
    totalItems = await Venbank.count({ where });
    
    // Fetch paginated data
    banks = await Venbank.findAll({
      where,
      limit: limit,
      offset: offset,
      order: [['id', 'DESC']],
    });
    
    const normalizedBanks = banks.map(normalizeVenbank);
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalItems / limit);
    hasNextPage = (page + 1) * limit < totalItems;
    
    return NextResponse.json({
      success: true,
      data: normalizedBanks,
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalItems: totalItems,
        totalPages: totalPages,
        hasNext: hasNextPage,
        hasPrevious: page > 0,
        startIndex: offset + 1,
        endIndex: Math.min(offset + limit, totalItems),
      },
    });
  }
}

//create
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, PERMISSIONS.BANK_DETAILS_WRITE);
  if (isAuthError(auth)) return auth;
  
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
    
    // Check if vendor already has bank details
    const existing = await Venbank.findOne({
      where: { vendorid: body.vendorid }
    });
    
    if (existing) {
      return NextResponse.json(
        { error: 'Vendor already has bank details' },
        { status: 400 }
      );
    }
    
    const bank = await Venbank.create({
      vendorid: body.vendorid,
      accven: body.accven || '',
      accname: body.accname,
      bankid: body.bankid || '',
      sortcde: body.sortcde || '',
      brnch: body.brnch || '',
      swiftcde: body.swiftcde || '',
      physicalAddress: body.physicalAddress || { streetName: '', town: '', plotNo: '' },
      countryoforigin: body.countryOfOrigin || '',
      email: body.email || '',
      phoneNumber: body.phoneNumber || '',
    });

    await logAuditEvent({
      userId: auth.id,
      username: auth.username,
      action: 'BANK_DETAILS_CREATED',
      resourceType: 'vendor_bank',
      resourceId: String(bank.id),
      summary: `${auth.username} created bank details for vendor ${body.vendorid}`,
      details: {
        vendorId: body.vendorid,
        accountName: body.accname,
        bankId: bank.id,
      },
      request,
    });

    return NextResponse.json({
      success: true,
      data: normalizeVenbank(bank),
      message: 'Bank record created successfully'
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating bank record:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create bank record' },
      { status: 500 }
    );
  }
}

// PUT - Update bank record
export async function PUT(request: NextRequest) {
  const auth = await requirePermission(request, PERMISSIONS.BANK_DETAILS_WRITE);
  if (isAuthError(auth)) return auth;
  
  try {
    await connectSageDatabase();
    
    const url = new URL(request.url);
    const id = parseInt(url.pathname.split('/').pop() || '0', 10);
    
    if (isNaN(id) || id === 0) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    
    // Validate required fields
    if (!body.vendorid || !body.accname) {
      return NextResponse.json(
        { error: 'Vendor ID and Account Name are required' },
        { status: 400 }
      );
    }
    
    const bank = await Venbank.findByPk(id);
    if (!bank) {
      return NextResponse.json(
        { error: 'Bank record not found' },
        { status: 404 }
      );
    }
    
    await bank.update({
      vendorid: body.vendorid,
      accven: body.accven || '',
      accname: body.accname,
      bankid: body.bankid || '',
      sortcde: body.sortcde || '',
      brnch: body.brnch || '',
      swiftcde: body.swiftcde || '',
      physicalAddress: body.physicalAddress || { streetName: '', town: '', plotNo: '' },
      countryOfOrigin: body.countryOfOrigin || '',
      email: body.email || '',
      phoneNumber: body.phoneNumber || '',
    });

    await logAuditEvent({
      userId: auth.id,
      username: auth.username,
      action: 'BANK_DETAILS_UPDATED',
      resourceType: 'vendor_bank',
      resourceId: String(bank.id),
      summary: `${auth.username} updated bank details for vendor ${body.vendorid}`,
      details: {
        vendorId: body.vendorid,
        accountName: body.accname,
        bankId: bank.id,
      },
      request,
    });

    return NextResponse.json({
      success: true,
      data: normalizeVenbank(bank),
      message: 'Bank record updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating bank record:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update bank record' },
      { status: 500 }
    );
  }
}

// // DELETE - Delete bank record
// export async function DELETE(request: NextRequest) {
//   const auth = await requirePermission(request, PERMISSIONS.BANK_DETAILS_DELETE);
//   if (isAuthError(auth)) return auth;
  
//   try {
//     await connectSageDatabase();
    
//     const url = new URL(request.url);
//     const id = parseInt(url.pathname.split('/').pop() || '0', 10);
    
//     if (isNaN(id) || id === 0) {
//       return NextResponse.json(
//         { error: 'Invalid ID format' },
//         { status: 400 }
//       );
//     }
    
//     const bank = await Venbank.findByPk(id);
//     if (!bank) {
//       return NextResponse.json(
//         { error: 'Bank record not found' },
//         { status: 404 }
//       );
//     }
    
//     const vendorId = bank.vendorid;
//     await bank.destroy();

//     await logAuditEvent({
//       userId: auth.id,
//       username: auth.username,
//       action: 'BANK_DETAILS_DELETED',
//       resourceType: 'vendor_bank',
//       resourceId: String(id),
//       summary: `${auth.username} deleted bank details for vendor ${vendorId}`,
//       details: {
//         vendorId: vendorId,
//         bankId: id,
//       },
//       request,
//     });

//     return NextResponse.json({
//       success: true,
//       message: 'Bank record deleted successfully'
//     });
//   } catch (error: any) {
//     console.error('Error deleting bank record:', error);
//     return NextResponse.json(
//       { error: error.message || 'Failed to delete bank record' },
//       { status: 500 }
//     );
//   }
// }