import { QueryTypes } from 'sequelize';
import sageSequelize from './sageDb';

export type SageVendorBankDetails = {
  accountNumber: string;
  accountName: string;
  bankName: string;
  branchCode: string;
  sortCode: string;
  swiftCode: string;
  countryOfOrigin: string;
  email: string;
  phoneNumber: string;
  paymentChannel: string;
  nfsInstitutionId: string;
  physicalAddress: {
    streetName: string;
    town: string;
    plotNo: string;
  };
  found: boolean;
  missingFields: string[];
};

type OptionalFieldMap = Record<keyof Omit<SageVendorBankDetails, 'found' | 'missingFields' | 'physicalAddress'> | 'addressLine1' | 'addressTown' | 'addressPlotNo', string[]>;

const DEFAULT_OPTIONAL_FIELDS: OptionalFieldMap = {
  accountNumber: ['BNKACCT', 'BANKACCT', 'ACCTNO'],
  accountName: ['BNKACCNM', 'ACCTNAME'],
  bankName: ['BNKNAME', 'BANKNAME'],
  branchCode: ['BRANCH', 'BRNCODE'],
  sortCode: ['SORTCODE'],
  swiftCode: ['SWIFT', 'BIC'],
  countryOfOrigin: ['COUNTRY'],
  email: ['BNKEMAIL', 'EMAIL'],
  phoneNumber: ['BNKPHONE', 'PHONE'],
  paymentChannel: ['PAYCHAN'],
  nfsInstitutionId: ['NFSINST', 'INSTID'],
  addressLine1: ['ADDR1'],
  addressTown: ['TOWN'],
  addressPlotNo: ['PLOTNO'],
};

function normalize(value: unknown) {
  return String(value ?? '').trim();
}

function parseConfiguredMap(): Partial<OptionalFieldMap> {
  const raw = process.env.SAGE_VENDOR_BANK_OPTIONAL_FIELDS;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string | string[]>;
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.map(normalize).filter(Boolean) : [normalize(value)].filter(Boolean),
      ]),
    ) as Partial<OptionalFieldMap>;
  } catch (error) {
    console.warn('Invalid SAGE_VENDOR_BANK_OPTIONAL_FIELDS JSON; using default optional field codes', error);
    return {};
  }
}

export function vendorBankOptionalFieldMap(): OptionalFieldMap {
  const configured = parseConfiguredMap();
  return {
    ...DEFAULT_OPTIONAL_FIELDS,
    ...configured,
  };
}

function readValue(values: Map<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const value = values.get(alias.toUpperCase());
    if (value) return value;
  }
  return '';
}

export async function loadVendorOptionalFields(vendorIds: string[]) {
  const ids = Array.from(new Set(vendorIds.map(normalize).filter(Boolean)));
  const byVendor = new Map<string, Map<string, string>>();
  if (!ids.length) return byVendor;

  const rows = await sageSequelize.query<{ vendorId: string; optfield: string; value: string }>(
    `
      SELECT
        LTRIM(RTRIM(VENDORID)) AS vendorId,
        UPPER(LTRIM(RTRIM(OPTFIELD))) AS optfield,
        LTRIM(RTRIM(CAST([VALUE] AS NVARCHAR(255)))) AS value
      FROM APVENO
      WHERE LTRIM(RTRIM(VENDORID)) IN (:vendorIds)
    `,
    {
      replacements: { vendorIds: ids },
      type: QueryTypes.SELECT,
    },
  );

  for (const row of rows) {
    const vendorId = normalize(row.vendorId);
    const optfield = normalize(row.optfield).toUpperCase();
    if (!vendorId || !optfield) continue;
    const current = byVendor.get(vendorId) ?? new Map<string, string>();
    current.set(optfield, normalize(row.value));
    byVendor.set(vendorId, current);
  }

  return byVendor;
}

export function buildVendorBankDetails(input: {
  vendorId: string;
  vendorName?: string;
  vendorEmail?: string;
  vendorPhone?: string;
  addressLine1?: string;
  town?: string;
  plotNo?: string;
  country?: string;
  optionalFields?: Map<string, string>;
}): SageVendorBankDetails {
  const fields = vendorBankOptionalFieldMap();
  const values = input.optionalFields ?? new Map<string, string>();
  const accountName = readValue(values, fields.accountName) || normalize(input.vendorName);
  const email = readValue(values, fields.email) || normalize(input.vendorEmail);
  const phoneNumber = readValue(values, fields.phoneNumber) || normalize(input.vendorPhone);
  const countryOfOrigin = readValue(values, fields.countryOfOrigin) || normalize(input.country);

  const details: SageVendorBankDetails = {
    accountNumber: readValue(values, fields.accountNumber),
    accountName,
    bankName: readValue(values, fields.bankName),
    branchCode: readValue(values, fields.branchCode),
    sortCode: readValue(values, fields.sortCode),
    swiftCode: readValue(values, fields.swiftCode),
    countryOfOrigin,
    email,
    phoneNumber,
    paymentChannel: readValue(values, fields.paymentChannel),
    nfsInstitutionId: readValue(values, fields.nfsInstitutionId),
    physicalAddress: {
      streetName: readValue(values, fields.addressLine1) || normalize(input.addressLine1),
      town: readValue(values, fields.addressTown) || normalize(input.town),
      plotNo: readValue(values, fields.addressPlotNo) || normalize(input.plotNo),
    },
    found: false,
    missingFields: [],
  };

  details.found = Boolean(details.accountNumber && details.accountName);
  details.missingFields = [
    ['accountNumber', details.accountNumber],
    ['accountName', details.accountName],
  ].filter(([, value]) => !value).map(([field]) => field);

  return details;
}
