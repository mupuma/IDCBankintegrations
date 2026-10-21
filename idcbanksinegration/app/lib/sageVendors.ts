import { QueryTypes } from 'sequelize';
import sage, { connectSageDatabase } from './sageDb';

export type SageVendorRow = {
  vendorid: string; vendname: string; currency: string; phoneNumber: string;
  email: string; addressLine1: string; addressLine2: string; city: string;
  country: string; taxNumber: string; active: number;
};

// APVEN is the complete master. Never restrict it through APPYM/payment history
// or through presence/completeness of bank details. Inactive vendors stay visible.
export async function loadSageVendors(search = ''): Promise<SageVendorRow[]> {
  await connectSageDatabase();
  return sage.query<SageVendorRow>(`
    SELECT LTRIM(RTRIM(v.VENDORID)) AS vendorid,
      LTRIM(RTRIM(v.VENDNAME)) AS vendname,
      LTRIM(RTRIM(v.CURNCODE)) AS currency,
      LTRIM(RTRIM(v.TEXTPHON1)) AS phoneNumber,
      LTRIM(RTRIM(v.EMAIL1)) AS email,
      LTRIM(RTRIM(v.TEXTSTRE1)) AS addressLine1,
      LTRIM(RTRIM(v.TEXTSTRE2)) AS addressLine2,
      LTRIM(RTRIM(v.NAMECITY)) AS city,
      LTRIM(RTRIM(v.CODECTRY)) AS country,
      LTRIM(RTRIM(v.TAXNBR)) AS taxNumber, v.SWACTV AS active
    FROM APVEN v
    WHERE LTRIM(RTRIM(v.VENDORID)) <> ''
      AND (:search IS NULL OR LTRIM(RTRIM(v.VENDORID)) LIKE :search
        OR LTRIM(RTRIM(v.VENDNAME)) LIKE :search)
    ORDER BY v.VENDORID ASC
  `, { replacements: { search: search.trim() ? `%${search.trim()}%` : null }, type: QueryTypes.SELECT });
}
