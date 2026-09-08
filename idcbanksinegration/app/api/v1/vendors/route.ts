import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { QueryTypes } from 'sequelize';
import { isAuthError, requirePermission } from '../../../lib/rbac';
import { PERMISSIONS } from '../../../lib/permissions';
import sageSequelize, { connectSageDatabase } from '../../../lib/sageDb';

type MissingVendorRow = {
  bankDetailsId: number | null;
  vendorid: string;
  vendname: string;
  accven: string | null;
  accname: string | null;
  bankid: string | null;
  sortcde: string | null;
  brnch: string | null;
  swiftcde: string | null;
  email: string | null;
  venbankPhoneNumber: string | null;
  physicalAddress: string | null;
  countryOfOrigin: string | null;
  currency: string;
  phoneNumber: string;
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
          MAX(b.ID) AS bankDetailsId,
          LTRIM(RTRIM(p.IDVEND)) AS vendorid,
          MAX(LTRIM(RTRIM(v.VENDNAME))) AS vendname,
          MAX(LTRIM(RTRIM(b.ACCVEN))) AS accven,
          MAX(LTRIM(RTRIM(b.ACCNAME))) AS accname,
          MAX(LTRIM(RTRIM(b.BANKID))) AS bankid,
          MAX(LTRIM(RTRIM(b.SORTCDE))) AS sortcde,
          MAX(LTRIM(RTRIM(b.BRNCH))) AS brnch,
          MAX(LTRIM(RTRIM(b.SWIFTCDE))) AS swiftcde,
          MAX(LTRIM(RTRIM(b.EMAIL))) AS email,
          MAX(LTRIM(RTRIM(b.PHONE_NUMBER))) AS venbankPhoneNumber,
          MAX(CAST(b.PHYSICAL_ADDRESS AS NVARCHAR(MAX))) AS physicalAddress,
          MAX(LTRIM(RTRIM(b.COUNTRY_OF_ORIGIN))) AS countryOfOrigin,
          MAX(LTRIM(RTRIM(v.CURNCODE))) AS currency,
          MAX(LTRIM(RTRIM(v.TEXTPHON1))) AS phoneNumber,
          MAX(LTRIM(RTRIM(v.NAMECITY))) AS city,
          MAX(LTRIM(RTRIM(v.CODECTRY))) AS country,
          COUNT(*) AS paymentCount,
          MAX(CAST(p.DATEBUS AS INT)) AS lastPaymentDate
        FROM APPYM p
        INNER JOIN APVEN v
          ON LTRIM(RTRIM(v.VENDORID)) = LTRIM(RTRIM(p.IDVEND))
        LEFT JOIN VENBANK b
          ON LTRIM(RTRIM(b.VENDORID)) = LTRIM(RTRIM(p.IDVEND))
        WHERE LTRIM(RTRIM(p.IDVEND)) <> ''
          AND (
            :search IS NULL
            OR LTRIM(RTRIM(p.IDVEND)) LIKE :search
            OR LTRIM(RTRIM(v.VENDNAME)) LIKE :search
          )
        GROUP BY LTRIM(RTRIM(p.IDVEND))
        HAVING
          MAX(b.ID) IS NULL
          OR NULLIF(MAX(LTRIM(RTRIM(b.ACCVEN))), '') IS NULL
          OR NULLIF(MAX(LTRIM(RTRIM(b.ACCNAME))), '') IS NULL
          OR NULLIF(MAX(LTRIM(RTRIM(b.BANKID))), '') IS NULL
        ORDER BY LTRIM(RTRIM(p.IDVEND)) ASC
      `,
      {
        replacements: { search: searchFilter },
        type: QueryTypes.SELECT,
      },
    );

    const vendors = rows.map((row) => ({
      bankDetailsId: row.bankDetailsId ? Number(row.bankDetailsId) : null,
      vendorid: normalizeText(row.vendorid),
      vendname: normalizeText(row.vendname),
      accven: normalizeText(row.accven),
      accname: normalizeText(row.accname),
      bankid: normalizeText(row.bankid),
      sortcde: normalizeText(row.sortcde),
      brnch: normalizeText(row.brnch),
      swiftcde: normalizeText(row.swiftcde),
      email: normalizeText(row.email),
      venbankPhoneNumber: normalizeText(row.venbankPhoneNumber),
      physicalAddress: normalizeText(row.physicalAddress),
      countryOfOrigin: normalizeText(row.countryOfOrigin),
      currency: normalizeText(row.currency),
      phoneNumber: normalizeText(row.phoneNumber),
      city: normalizeText(row.city),
      country: normalizeText(row.country),
      paymentCount: Number(row.paymentCount ?? 0),
      lastPaymentDate: row.lastPaymentDate ? Number(row.lastPaymentDate) : null,
      bankDetailsStatus: row.bankDetailsId ? 'incomplete' as const : 'missing' as const,
    }));

    return NextResponse.json({
      success: true,
      data: vendors.map((vendor) => vendor.vendorid),
      vendors,
      total: vendors.length,
    });
  } catch (error: any) {
    console.error('Error fetching payment vendors missing bank details:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to load payment vendors missing bank details',
      },
      { status: 500 },
    );
  }
}
