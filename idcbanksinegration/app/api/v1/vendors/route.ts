import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAuthError, requirePermission } from '../../../lib/rbac';
import { PERMISSIONS } from '../../../lib/permissions';
import { loadSageVendors } from '../../../lib/sageVendors';
import { buildVendorBankDetails, loadVendorOptionalFields } from '../../../lib/sageVendorBankDetails';
import { connectVendorBankDatabase } from '../../../lib/vendorBankStore';
import { VendorBankDetail } from '../../../models/internal/VendorBankDetail';

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, PERMISSIONS.BANK_DETAILS_READ);
  if (isAuthError(auth)) return auth;

  try {
    const store = await connectVendorBankDatabase();
    const localBanks = await VendorBankDetail.findAll();
    const localByVendor = new Map(localBanks.map(bank => [(bank.vendorid || '').trim(), bank]));

    const search = normalizeText(request.nextUrl.searchParams.get('search'));
    const rows = await loadSageVendors(search);

    const optionalFields = await loadVendorOptionalFields(rows.map((row) => row.vendorid));
    const vendors = rows
      .map((row) => {
        const vendorid = normalizeText(row.vendorid);
        const local = localByVendor.get(vendorid);
        const bankDetails = buildVendorBankDetails({
          vendorId: vendorid,
          vendorName: row.vendname,
          vendorEmail: row.email,
          vendorPhone: row.phoneNumber,
          addressLine1: row.addressLine1,
          plotNo: row.addressLine2,
          town: row.city,
          country: row.country,
          taxNumber: row.taxNumber,
          optionalFields: optionalFields.get(vendorid),
        });

        return {
          bankDetailsId: local ? `portal-${local.id}` : null,
          vendorid,
          vendname: normalizeText(row.vendname),
          accven: local?.accven || bankDetails.accountNumber,
          accname: local?.accname || bankDetails.accountName,
          bankid: local?.bankid || bankDetails.bankName,
          sortcde: local?.sortcde || bankDetails.sortCode,
          brnch: local?.brnch || bankDetails.branchCode,
          swiftcde: local?.swiftcde || bankDetails.swiftCode,
          tpin: local?.tpin || bankDetails.tpin,
          purposeCode: local?.purposeCode || bankDetails.purposeCode,
          sectorCode: local?.sectorCode || bankDetails.sectorCode,
          email: local?.email || bankDetails.email,
          venbankPhoneNumber: local?.phoneNumber || bankDetails.phoneNumber,
          physicalAddress: JSON.stringify(local?.physicalAddress || bankDetails.physicalAddress),
          countryOfOrigin: local?.countryOfOrigin || bankDetails.countryOfOrigin,
          currency: normalizeText(row.currency),
          phoneNumber: normalizeText(row.phoneNumber),
          city: normalizeText(row.city),
          country: normalizeText(row.country),
          active: Number(row.active) !== 0,
          missingBankFields: bankDetails.missingFields,
          bankDetailsStatus: local?.accven && local?.accname ? 'complete' as const : 'missing' as const,
        };
      });

    return NextResponse.json({
      success: true,
      warning: store?.warning,
      sageVendorCount: store?.sageVendorCount,
      data: vendors.map((vendor) => vendor.vendorid),
      vendors,
      total: vendors.length,
    });
  } catch (error: unknown) {
    console.error('Error fetching Sage vendor master:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load Sage vendor master',
      },
      { status: 500 },
    );
  }
}
