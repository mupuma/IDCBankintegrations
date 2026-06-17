// import { NextResponse } from 'next/server';
// import type { NextRequest } from 'next/server';
// import { isAuthError, requirePermission } from '../../../lib/rbac';
// import { PERMISSIONS } from '../../../lib/permissions';
// import { connectSageDatabase } from '../../../lib/sageDb';
// import { Apven } from '../../../models/sage_entities/Apven';
// import { Venbank } from '../../../models/sage_entities/Venbank';
// import { Op } from 'sequelize';

// export async function GET(request: NextRequest) {
//   const auth = await requirePermission(request, PERMISSIONS.BANK_DETAILS_READ);
//   if (isAuthError(auth)) return auth;

//   try {
//     await connectSageDatabase();

//     const existingVendors = await Venbank.findAll({
//       attributes: ['vendorid'],
//       raw: true,
//     });

//     const excludedVendorIds = existingVendors
//       .map((record) => String(record.vendorid || '').trim())
//       .filter((vendorId) => vendorId !== '');

//     const where: any = {};
//     if (excludedVendorIds.length > 0) {
//       where.vendorid = { [Op.notIn]: excludedVendorIds };
//     }

//     const vendors = await Apven.findAll({
//       attributes: ['vendorid'],
//       where,
//       order: [['vendorid', 'ASC']],
//       raw: true,
//     });

//     return NextResponse.json({
//       success: true,
//       data: vendors.map((row) => row.vendorid),
//     });
//   } catch (error: any) {
//     console.error('Error fetching vendor options:', error);
//     return NextResponse.json(
//       { error: error.message || 'Failed to load vendor list' },
//       { status: 500 }
//     );
//   }
// }


// app/api/v1/bank_details/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAuthError, requirePermission } from '../../../lib/rbac';
import { PERMISSIONS } from '../../../lib/permissions';
import { connectSageDatabase } from '../../../lib/sageDb';
import { Venbank } from '../../../models/sage_entities/Venbank';
import { Op, Sequelize } from 'sequelize';

// GET - Fetch all bank details with pagination, search, and filters
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, PERMISSIONS.BANK_DETAILS_READ);
  if (isAuthError(auth)) return auth;

  try {
    await connectSageDatabase();

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '0', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const search = searchParams.get('search') || '';
    const vendorid = searchParams.get('vendorid') || '';

    // Validate pagination parameters
    const validPage = Math.max(0, page);
    const validLimit = Math.min(100, Math.max(1, limit));

    // Build where clause
    const whereClause: any = {};

    // Add search conditions
    if (search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      whereClause[Op.or] = [
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
        // For JSON field search (if supported by your database)
        ...(process.env.DB_TYPE === 'postgres' ? [
          Sequelize.literal(`CAST("physicalAddress" AS TEXT) LIKE '${searchTerm}'`)
        ] : process.env.DB_TYPE === 'mysql' ? [
          Sequelize.literal(`JSON_EXTRACT(physicalAddress, '$.*') LIKE '${searchTerm}'`)
        ] : [])
      ];
    }

    // Add vendor filter
    if (vendorid.trim()) {
      whereClause.vendorid = { [Op.like]: `%${vendorid.trim()}%` };
    }

    // Calculate offset
    const offset = validPage * validLimit;

    // Get total count
    const totalItems = await Venbank.count({
      where: whereClause,
    });

    // Fetch paginated data
    const banks = await Venbank.findAll({
      where: whereClause,
      limit: validLimit,
      offset: offset,
      order: [['id', 'DESC']],
      raw: true,
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalItems / validLimit);
    const hasNext = (validPage + 1) * validLimit < totalItems;
    const hasPrevious = validPage > 0;

    return NextResponse.json({
      success: true,
      data: banks.map(bank => ({
        id: bank.id,
        vendorid: bank.vendorid || '',
        accven: bank.accven || '',
        accname: bank.accname || '',
        bankid: bank.bankid || '',
        sortcde: bank.sortcde || '',
        brnch: bank.brnch || '',
        swiftcde: bank.swiftcde || '',
        physicalAddress: bank.physicalAddress || { streetName: '', town: '', plotNo: '' },
        countryOfOrigin: bank.countryOfOrigin || '',
        email: bank.email || '',
        phoneNumber: bank.phoneNumber || '',
      })),
      pagination: {
        currentPage: validPage,
        pageSize: validLimit,
        totalItems: totalItems,
        totalPages: totalPages,
        hasNext: hasNext,
        hasPrevious: hasPrevious,
        startIndex: offset + 1,
        endIndex: Math.min(offset + validLimit, totalItems),
      }
    });

  } catch (error: any) {
    console.error('Error fetching bank details:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to load bank details from Sage' 
      },
      { status: 500 }
    );
  }
}

// GET single bank record by ID
export async function GET_BY_ID(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, PERMISSIONS.BANK_DETAILS_READ);
  if (isAuthError(auth)) return auth;

  try {
    await connectSageDatabase();

    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid ID format' },
        { status: 400 }
      );
    }

    const bank = await Venbank.findByPk(id, { raw: true });

    if (!bank) {
      return NextResponse.json(
        { success: false, error: 'Bank record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: bank.id,
        vendorid: bank.vendorid || '',
        accven: bank.accven || '',
        accname: bank.accname || '',
        bankid: bank.bankid || '',
        sortcde: bank.sortcde || '',
        brnch: bank.brnch || '',
        swiftcde: bank.swiftcde || '',
        physicalAddress: bank.physicalAddress || { streetName: '', town: '', plotNo: '' },
        countryOfOrigin: bank.countryOfOrigin || '',
        email: bank.email || '',
        phoneNumber: bank.phoneNumber || '',
      }
    });

  } catch (error: any) {
    console.error('Error fetching bank detail:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load bank detail from Sage' },
      { status: 500 }
    );
  }
}

// POST - Create new bank record
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, PERMISSIONS.BANK_DETAILS_WRITE);
  if (isAuthError(auth)) return auth;

  try {
    await connectSageDatabase();

    const body = await request.json();

    // Validate required fields
    if (!body.vendorid || !body.vendorid.trim()) {
      return NextResponse.json(
        { success: false, error: 'Vendor ID is required' },
        { status: 400 }
      );
    }

    if (!body.accname || !body.accname.trim()) {
      return NextResponse.json(
        { success: false, error: 'Account Name is required' },
        { status: 400 }
      );
    }

    // Check if vendor already has bank details
    const existing = await Venbank.findOne({
      where: { vendorid: body.vendorid.trim() }
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Vendor already has bank details' },
        { status: 400 }
      );
    }

    // Create new bank record
    const newBank = await Venbank.create({
      vendorid: body.vendorid.trim(),
      accven: body.accven?.trim() || '',
      accname: body.accname.trim(),
      bankid: body.bankid?.trim() || '',
      sortcde: body.sortcde?.trim() || '',
      brnch: body.brnch?.trim() || '',
      swiftcde: body.swiftcde?.trim() || '',
      physicalAddress: {
        streetName: body.streetName?.trim() || '',
        town: body.town?.trim() || '',
        plotNo: body.plotNo?.trim() || '',
      },
      countryoforigin: body.countryOfOrigin?.trim() || '',
      email: body.email?.trim() || '',
      phoneNumber: body.phoneNumber?.trim() || '',
    });

    return NextResponse.json({
      success: true,
      data: newBank,
      message: 'Bank record created successfully'
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating bank record:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to create bank record in Sage' 
      },
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
        { success: false, error: 'Invalid ID format' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.vendorid || !body.vendorid.trim()) {
      return NextResponse.json(
        { success: false, error: 'Vendor ID is required' },
        { status: 400 }
      );
    }

    if (!body.accname || !body.accname.trim()) {
      return NextResponse.json(
        { success: false, error: 'Account Name is required' },
        { status: 400 }
      );
    }

    const bank = await Venbank.findByPk(id);
    if (!bank) {
      return NextResponse.json(
        { success: false, error: 'Bank record not found' },
        { status: 404 }
      );
    }

    // Update fields
    await bank.update({
      vendorid: body.vendorid.trim(),
      accven: body.accven?.trim() || '',
      accname: body.accname.trim(),
      bankid: body.bankid?.trim() || '',
      sortcde: body.sortcde?.trim() || '',
      brnch: body.brnch?.trim() || '',
      swiftcde: body.swiftcde?.trim() || '',
      physicalAddress: {
        streetName: body.streetName?.trim() || '',
        town: body.town?.trim() || '',
        plotNo: body.plotNo?.trim() || '',
      },
      countryOfOrigin: body.countryOfOrigin?.trim() || '',
      email: body.email?.trim() || '',
      phoneNumber: body.phoneNumber?.trim() || '',
    });

    return NextResponse.json({
      success: true,
      data: bank,
      message: 'Bank record updated successfully'
    });

  } catch (error: any) {
    console.error('Error updating bank record:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to update bank record in Sage' 
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete bank record
// export async function DELETE(request: NextRequest) {
//   const auth = await requirePermission(request, PERMISSIONS.BANK_DETAILS_DELETE);
//   if (isAuthError(auth)) return auth;

//   try {
//     await connectSageDatabase();

//     const url = new URL(request.url);
//     const id = parseInt(url.pathname.split('/').pop() || '0', 10);
    
//     if (isNaN(id) || id === 0) {
//       return NextResponse.json(
//         { success: false, error: 'Invalid ID format' },
//         { status: 400 }
//       );
//     }

//     const bank = await Venbank.findByPk(id);
//     if (!bank) {
//       return NextResponse.json(
//         { success: false, error: 'Bank record not found' },
//         { status: 404 }
//       );
//     }

//     await bank.destroy();

//     return NextResponse.json({
//       success: true,
//       message: 'Bank record deleted successfully'
//     });

//   } catch (error: any) {
//     console.error('Error deleting bank record:', error);
//     return NextResponse.json(
//       { 
//         success: false, 
//         error: error.message || 'Failed to delete bank record from Sage' 
//       },
//       { status: 500 }
//     );
//   }
// }