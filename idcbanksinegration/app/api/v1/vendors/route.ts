import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAuthError, requirePermission } from '../../../lib/rbac';
import { PERMISSIONS } from '../../../lib/permissions';
import { connectSageDatabase } from '../../../lib/sageDb';
import { Apven } from '../../../models/sage_entities/Apven';
import { Venbank } from '../../../models/sage_entities/Venbank';
import { Op } from 'sequelize';

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, PERMISSIONS.BANK_DETAILS_READ);
  if (isAuthError(auth)) return auth;

  try {
    await connectSageDatabase();

    const existingVendors = await Venbank.findAll({
      attributes: ['vendorid'],
      raw: true,
    });

    const excludedVendorIds = existingVendors
      .map((record) => String(record.vendorid || '').trim())
      .filter((vendorId) => vendorId !== '');

    const where: any = {};
    if (excludedVendorIds.length > 0) {
      where.vendorid = { [Op.notIn]: excludedVendorIds };
    }

    const vendors = await Apven.findAll({
      attributes: ['vendorid'],
      where,
      order: [['vendorid', 'ASC']],
      raw: true,
    });

    return NextResponse.json({
      success: true,
      data: vendors.map((row) => row.vendorid),
    });
  } catch (error: any) {
    console.error('Error fetching vendor options:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load vendor list' },
      { status: 500 }
    );
  }
}
