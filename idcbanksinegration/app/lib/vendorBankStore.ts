import { QueryTypes } from 'sequelize';
import { connectDatabase } from './db';
import sage, { connectSageDatabase } from './sageDb';
import { VendorBankDetail } from '../models/internal/VendorBankDetail';
import { normalizeVendorBankRecord, vendorBankFailureDetails, vendorBankReadError } from './vendorBankRead';

const legacyFields: Record<string, string> = {
  vendorid: 'VENDORID', accven: 'ACCVEN', accname: 'ACCNAME', bankid: 'BANKID',
  sortcde: 'SORTCDE', brnch: 'BRNCH', swiftcde: 'SWIFTCDE', tpin: 'TPIN',
  purposeCode: 'PURPOSE_CODE', sectorCode: 'SECTOR_CODE', physicalAddress: 'PHYSICAL_ADDRESS',
  countryOfOrigin: 'COUNTRY_OF_ORIGIN', email: 'EMAIL', phoneNumber: 'PHONE_NUMBER',
};
const quote = (name: string) => `[${name.replace(/]/g, ']]')}]`;
let imported: Promise<{ warning?: string }> | null = null;

// SQL Server is a read-only source here. Existing bank details are copied into
// MySQL once per process, only for vendors not already maintained in the portal.
export async function importLegacyVendorBanks() {
  let stage: 'sage_read' | 'portal_save' = 'sage_read';
  try {
  await connectSageDatabase();
  const schema = process.env.SAGE_VENBANK_SCHEMA?.trim();
  const table = schema ? `${quote(schema)}.[VENBANK]` : '[VENBANK]';
  const columns = await sage.query<{ name: string }>(
    `SELECT name FROM sys.columns WHERE object_id = OBJECT_ID(:table, 'U')`,
    { replacements: { table }, type: QueryTypes.SELECT },
  );
  const available = new Set(columns.map(column => column.name.toUpperCase()));
  if (!available.has('VENDORID')) {
    console.warn('Legacy Sage VENBANK is not visible; portal vendor details remain available in MySQL');
    return { warning: 'Legacy Sage bank details are not accessible. Saved portal records are shown. If vendors are missing, verify the Sage company database, schema and read permissions.' };
  }
  const select = Object.entries(legacyFields).filter(([, column]) => available.has(column))
    .map(([property, column]) => `${quote(column)} AS ${quote(property)}`).join(', ');
  const rows = await sage.query<Record<string, unknown>>(`SELECT ${select} FROM ${table}`, { type: QueryTypes.SELECT });
  stage = 'portal_save';
  for (const row of rows) {
    const vendorid = String(row.vendorid ?? '').trim();
    if (!vendorid) continue;
    const values = normalizeVendorBankRecord(row);
    for (const key of Object.keys(legacyFields)) {
      if (typeof values[key] === 'string') values[key] = values[key].trim();
    }
    // Include soft-deleted portal rows so a refresh never resurrects them.
    await VendorBankDetail.findOrCreate({ where: { vendorid }, defaults: { ...values, vendorid }, paranoid: false });
  }
  return {};
  } catch (cause) {
    throw Object.assign(new Error('Vendor bank import failed'), { importStage: stage, cause });
  }
}

export async function connectVendorBankDatabase() {
  await connectDatabase();
  if (!imported) imported = importLegacyVendorBanks().catch(error => {
    imported = null;
    const stage = (error as { importStage?: string }).importStage || 'sage_read';
    const details = vendorBankFailureDetails(error);
    console.warn('Vendor bank import failed; saved portal records retained', { stage, ...details });
    const explanation = stage === 'portal_save' ? 'Sage bank details were read, but saving them to portal MySQL failed.' : 'Reading bank details from Sage failed.';
    return { warning: `${explanation} ${details.code ? `(${details.code}${details.column ? `: ${details.column}` : ''}) ` : ''}${vendorBankReadError(error)}` };
  });
  return await imported;
}
