import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { QueryTypes } from 'sequelize';
import { isAuthError, requirePermission } from '../../../lib/rbac';
import { PERMISSIONS } from '../../../lib/permissions';
import sageSequelize, { connectSageDatabase } from '../../../lib/sageDb';
import { buildVendorBankDetails, loadVendorOptionalFields } from '../../../lib/sageVendorBankDetails';

type MissingVendorRow = {
  vendorid: string;
  vendname: string;
  currency: string;
  phoneNumber: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  country: string;
  paymentCount: number;
  lastPaymentDate: number | null;
};

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, PERMISSIONS.BANK_DETAILS_READ);
  if (isAuthError(auth)) return auth;

  try {
    await connectSageDatabase();

    const search = normalizeText(request.nextUrl.searchParams.get('search'));
    const searchFilter = search ? `%${search}%` : null;

    const rows = await sageSequelize.query<MissingVendorRow>(
      `
        SELECT
          LTRIM(RTRIM(p.IDVEND)) AS vendorid,
          MAX(LTRIM(RTRIM(v.VENDNAME))) AS vendname,
          MAX(LTRIM(RTRIM(v.CURNCODE))) AS currency,
          MAX(LTRIM(RTRIM(v.TEXTPHON1))) AS phoneNumber,
          MAX(LTRIM(RTRIM(v.EMAIL1))) AS email,
          MAX(LTRIM(RTRIM(v.TEXTSTRE1))) AS addressLine1,
          MAX(LTRIM(RTRIM(v.TEXTSTRE2))) AS addressLine2,
          MAX(LTRIM(RTRIM(v.NAMECITY))) AS city,
          MAX(LTRIM(RTRIM(v.CODECTRY))) AS country,
          COUNT(*) AS paymentCount,
          MAX(CAST(p.DATEBUS AS INT)) AS lastPaymentDate
        FROM APPYM p
        INNER JOIN APVEN v
          ON LTRIM(RTRIM(v.VENDORID)) = LTRIM(RTRIM(p.IDVEND))
        WHERE LTRIM(RTRIM(p.IDVEND)) <> ''
          AND (
            :search IS NULL
            OR LTRIM(RTRIM(p.IDVEND)) LIKE :search
            OR LTRIM(RTRIM(v.VENDNAME)) LIKE :search
          )
        GROUP BY LTRIM(RTRIM(p.IDVEND))
        ORDER BY LTRIM(RTRIM(p.IDVEND)) ASC
      `,
      {
        replacements: { search: searchFilter },
        type: QueryTypes.SELECT,
      },
    );

    const optionalFields = await loadVendorOptionalFields(rows.map((row) => row.vendorid));
    const vendors = rows
      .map((row) => {
        const vendorid = normalizeText(row.vendorid);
        const bankDetails = buildVendorBankDetails({
          vendorId: vendorid,
          vendorName: row.vendname,
          vendorEmail: row.email,
          vendorPhone: row.phoneNumber,
          addressLine1: row.addressLine1,
          plotNo: row.addressLine2,
          town: row.city,
          country: row.country,
          optionalFields: optionalFields.get(vendorid),
        });

        return {
          bankDetailsId: null,
          vendorid,
          vendname: normalizeText(row.vendname),
          accven: bankDetails.accountNumber,
          accname: bankDetails.accountName,
          bankid: bankDetails.bankName,
          sortcde: bankDetails.sortCode,
          brnch: bankDetails.branchCode,
          swiftcde: bankDetails.swiftCode,
          email: bankDetails.email,
          venbankPhoneNumber: bankDetails.phoneNumber,
          physicalAddress: [
            bankDetails.physicalAddress.plotNo,
            bankDetails.physicalAddress.streetName,
            bankDetails.physicalAddress.town,
          ].filter(Boolean).join(', '),
          countryOfOrigin: bankDetails.countryOfOrigin,
          currency: normalizeText(row.currency),
          phoneNumber: normalizeText(row.phoneNumber),
          city: normalizeText(row.city),
          country: normalizeText(row.country),
          paymentCount: Number(row.paymentCount ?? 0),
          lastPaymentDate: row.lastPaymentDate ? Number(row.lastPaymentDate) : null,
          missingBankFields: bankDetails.missingFields,
          bankDetailsStatus: bankDetails.found ? 'complete' as const : 'missing' as const,
        };
      })
      .filter((vendor) => vendor.bankDetailsStatus !== 'complete');

    return NextResponse.json({
      success: true,
      data: vendors.map((vendor) => vendor.vendorid),
      vendors,
      total: vendors.length,
    });
  } catch (error: unknown) {
    console.error('Error fetching payment vendors missing bank details:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load payment vendors missing bank details',
      },
      { status: 500 },
    );
  }
}
