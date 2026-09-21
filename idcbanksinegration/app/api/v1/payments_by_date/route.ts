import { isAuthError, requirePermission } from '@/app/lib/rbac';
import { PERMISSIONS } from '@/app/lib/permissions';
import { connectSageDatabase } from '@/app/lib/sageDb';
import { PaymentsResponse, PaymentsRequest } from '@/app/models/dtos';
import { Appym } from '@/app/models/sage_entities/Appym';
import { Aptcr } from '@/app/models/sage_entities/Aptcr';
import { Apven } from '@/app/models/sage_entities/Apven';
import { Venbank } from '@/app/models/sage_entities/Venbank';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Op } from 'sequelize';

type SageRawRecord = Record<string, unknown>;
type NormalizedPayment = PaymentsResponse & {
  paymentId: string;
  bankDetailsFound: boolean;
  missingBankFields: string[];
  bankDetailsStatus: 'complete' | 'incomplete';
  nfsInstitutionId?: string;
  paymentChannel?: string;
};

type VendorBankDetails = {
  accountNumber: string;
  accountName: string;
  bankName: string;
  branchCode: string;
  sortCode: string;
  swiftCode: string;
  countryOfOrigin: string;
  email: string;
  phoneNumber: string;
  physicalAddress: PaymentsResponse['physicalAddress'];
  found: boolean;
  missingFields: string[];
};

const VENBANK_ATTRIBUTES = [
  'vendorid',
  'accven',
  'accname',
  'bankid',
  'sortcde',
  'brnch',
  'swiftcde',
  'physicalAddress',
  'countryOfOrigin',
  'email',
  'phoneNumber',
];

function parseNumericDate(value: number | string): Date {
  const raw = String(value || '');
  if (/^\d{8}$/.test(raw)) {
    const year = Number(raw.slice(0, 4));
    const month = Number(raw.slice(4, 6)) - 1;
    const day = Number(raw.slice(6, 8));
    return new Date(Date.UTC(year, month, day));
  }

  return new Date(Number(value) || Date.now());
}

function mapTransactionType(paymcode: string | undefined): PaymentsResponse['transactionType'] {
  const code = String(paymcode || '').toUpperCase();
  if (code.includes('RTGS')) return 'RTGS';
  if (code.includes('INT')) return 'INT';
  if (code.includes('TT')) return 'TT';
  return 'DDACCT';
}

function getRawField<T>(record: SageRawRecord | null | undefined, keys: string[], fallback: T): T {
  if (!record) return fallback;

  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return record[key] as T;
    }
  }

  return fallback;
}

function trimString(value: unknown) {
  return String(value ?? '').trim();
}

function parsePhysicalAddress(value: unknown): PaymentsResponse['physicalAddress'] {
  const empty = { streetName: '', town: '', plotNo: '' };
  if (!value) return empty;

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return {
      streetName: trimString(record.streetName ?? record.street ?? record.addressLine1),
      town: trimString(record.town ?? record.city),
      plotNo: trimString(record.plotNo ?? record.plotNumber),
    };
  }

  const raw = trimString(value);
  if (!raw) return empty;

  try {
    return parsePhysicalAddress(JSON.parse(raw));
  } catch {
    return { ...empty, streetName: raw };
  }
}

function buildAddressFromApven(vendor: SageRawRecord | undefined): PaymentsResponse['physicalAddress'] {
  return {
    streetName: trimString(getRawField(vendor, ['textstre1', 'TEXTSTRE1'], '')),
    town: trimString(getRawField(vendor, ['namecity', 'NAMECITY'], '')),
    plotNo: trimString(getRawField(vendor, ['textstre2', 'TEXTSTRE2'], '')),
  };
}

function normalizeVenbank(bank: SageRawRecord | undefined): VendorBankDetails {
  const details: VendorBankDetails = {
    accountNumber: trimString(getRawField(bank, ['accven', 'ACCVEN'], '')),
    accountName: trimString(getRawField(bank, ['accname', 'ACCNAME'], '')),
    bankName: trimString(getRawField(bank, ['bankid', 'BANKID'], '')),
    branchCode: trimString(getRawField(bank, ['brnch', 'BRNCH'], '')),
    sortCode: trimString(getRawField(bank, ['sortcde', 'SORTCDE'], '')),
    swiftCode: trimString(getRawField(bank, ['swiftcde', 'SWIFTCDE'], '')),
    countryOfOrigin: trimString(getRawField(bank, ['countryOfOrigin', 'COUNTRY_OF_ORIGIN'], '')),
    email: trimString(getRawField(bank, ['email', 'EMAIL'], '')),
    phoneNumber: trimString(getRawField(bank, ['phoneNumber', 'PHONE_NUMBER'], '')),
    physicalAddress: parsePhysicalAddress(getRawField(bank, ['physicalAddress', 'PHYSICAL_ADDRESS'], null)),
    found: false,
    missingFields: [],
  };

  details.found = Boolean(bank && details.accountNumber && details.accountName);
  details.missingFields = [
    ['accountNumber', details.accountNumber],
    ['accountName', details.accountName],
  ].filter(([, value]) => !value).map(([field]) => field);

  return details;
}

async function loadVenbanksByVendor(vendorIds: string[]) {
  if (!vendorIds.length) return new Map<string, SageRawRecord>();

  const rows = await Venbank.findAll({
    attributes: VENBANK_ATTRIBUTES,
    where: {
      vendorid: {
        [Op.in]: vendorIds,
      },
    },
    raw: true,
  }) as unknown as SageRawRecord[];

  const byVendor = new Map<string, SageRawRecord>();
  rows.forEach((bankDetails) => {
    const vendorId = trimString(getRawField(bankDetails, ['vendorid', 'VENDORID'], ''));
    if (vendorId) byVendor.set(vendorId, bankDetails);
  });

  return byVendor;
}

async function seedMissingVenbanksFromApven(vendorIds: string[], existingVenbanks: Map<string, SageRawRecord>) {
  const missingVendorIds = vendorIds.filter((vendorId) => !existingVenbanks.has(vendorId));
  if (!missingVendorIds.length) return 0;

  const vendors = await Apven.findAll({
    attributes: [
      'vendorid',
      'vendname',
      'textstre1',
      'textstre2',
      'namecity',
      'codectry',
      'email1',
      'textphon1',
    ],
    where: {
      vendorid: {
        [Op.in]: missingVendorIds,
      },
    },
    raw: true,
  }) as unknown as SageRawRecord[];

  let seeded = 0;
  for (const vendor of vendors) {
    const vendorId = trimString(getRawField(vendor, ['vendorid', 'VENDORID'], ''));
    if (!vendorId || existingVenbanks.has(vendorId)) continue;

    const vendorName = trimString(getRawField(vendor, ['vendname', 'VENDNAME'], ''));
    await Venbank.create({
      vendorid: vendorId,
      accven: '',
      accname: vendorName,
      bankid: '',
      sortcde: '',
      brnch: '',
      swiftcde: '',
      physicalAddress: buildAddressFromApven(vendor),
      countryOfOrigin: trimString(getRawField(vendor, ['codectry', 'CODECTRY'], '')),
      email: trimString(getRawField(vendor, ['email1', 'EMAIL1'], '')),
      phoneNumber: trimString(getRawField(vendor, ['textphon1', 'TEXTPHON1'], '')),
    });
    seeded += 1;
  }

  return seeded;
}

function normalizePayment(appym: SageRawRecord, bankDetails: VendorBankDetails, remarks: string): NormalizedPayment {
  const idbank = String(getRawField(appym, ['idbank', 'IDBANK'], '')).trim();
  const vendorId = String(getRawField(appym, ['idvend', 'IDVEND'], '')).trim();
  const idrmit = String(getRawField(appym, ['idrmit', 'IDRMIT'], '')).trim();
  const longserial = String(getRawField(appym, ['longserial', 'LONGSERIAL'], '')).trim();

  return {
    accountNumber: bankDetails.accountNumber,
    amount: Number(getRawField(appym, ['amtpaym', 'AMTPAYM'], 0)),
    currency: String(getRawField(appym, ['codecurn', 'CODECURN'], '')).trim(),
    currencyCode: String(getRawField(appym, ['codecurn', 'CODECURN'], '')).trim(),
    remarks,
    vendorId,
    accountName: bankDetails.accountName,
    branchCode: bankDetails.branchCode,
    sortCode: bankDetails.sortCode,
    swiftCode: bankDetails.swiftCode,
    bankName: bankDetails.bankName,
    email: bankDetails.email,
    phoneNumber: bankDetails.phoneNumber,
    physicalAddress: bankDetails.physicalAddress,
    countryOfOrigin: bankDetails.countryOfOrigin,
    currencyCde: String(getRawField(appym, ['codecurn', 'CODECURN'], '')).trim(),
    transactionDate: parseNumericDate(getRawField(appym, ['datebus', 'DATEBUS'], getRawField(appym, ['datermit', 'DATERMIT'], 0))),
    transactionType: mapTransactionType(String(getRawField(appym, ['paymcode', 'PAYMCODE'], ''))),
    transactionReference: String(remarks || idrmit || idbank || longserial).trim(),
    paymentId: `${idbank || 'UNK'}|${vendorId || 'UNK'}|${idrmit || 'UNK'}|${longserial || 'UNK'}|${String(getRawField(appym, ['datermit', 'DATERMIT'], '')).trim() || 'UNK'}`,
    bankDetailsFound: bankDetails.found,
    missingBankFields: bankDetails.missingFields,
    bankDetailsStatus: bankDetails.found ? 'complete' : 'incomplete',
  };
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, PERMISSIONS.PAYMENTS_READ);
  if (isAuthError(auth)) return auth;

  try {
    await connectSageDatabase();
    const body = await request.json();
    const payload = body as PaymentsRequest;
    const startDate = Number(payload.startDate || 0);
    const endDate = Number(payload.endDate || 0);

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate are required.' }, { status: 400 });
    }

    const payments = await Appym.findAll({
      attributes: [
        'idbank',
        'idvend',
        'idrmit',
        'longserial',
        'datermit',
        'amtpaym',
        'paymcode',
        'codecurn',
        'datebus',
        'textretrn',
        'textpayor',
        'cntbtch',
        'cntitem',
      ],
      where: {
        datebus: {
          [Op.between]: [startDate, endDate],
        },
      },
      order: [['datebus', 'ASC'], ['idvend', 'ASC']],
      raw: true,
    }) as unknown as SageRawRecord[];

    const vendorIds = Array.from(
      new Set(
        payments
          .map((item) => String(getRawField(item, ['idvend', 'IDVEND'], '')).trim())
          .filter(Boolean)
      )
    );

    let venbankByVendor = await loadVenbanksByVendor(vendorIds);
    const seededVendorCount = await seedMissingVenbanksFromApven(vendorIds, venbankByVendor);
    if (seededVendorCount > 0) {
      venbankByVendor = await loadVenbanksByVendor(vendorIds);
    }

    const aptcrPairs = new Set<string>();
    const aptcrSearch: Array<{ cntbtch: number; cntentr: number }> = [];
    payments.forEach((item) => {
      const cntbtch = getRawField(item, ['cntbtch', 'CNTBTCH'], null);
      const cntitem = getRawField(item, ['cntitem', 'CNTITEM'], null);
      if (cntbtch != null && cntitem != null) {
        const key = `${cntbtch}|${cntitem}`;
        if (!aptcrPairs.has(key)) {
          aptcrPairs.add(key);
          aptcrSearch.push({ cntbtch: Number(cntbtch), cntentr: Number(cntitem) });
        }
      }
    });

    const aptcrRows = aptcrSearch.length
      ? await Aptcr.findAll({
          where: {
            [Op.or]: aptcrSearch,
          },
          raw: true,
        }) as unknown as SageRawRecord[]
      : [];

    const aptcrMap = new Map<string, string>();
    aptcrRows.forEach((row) => {
      const key = `${getRawField(row, ['cntbtch', 'CNTBTCH'], '')}|${getRawField(row, ['cntentr', 'CNTENTR'], '')}`;
      const value = String(getRawField(row, ['textrmit', 'TEXTRMIT'], '')).trim();
      if (key) aptcrMap.set(key, value);
    });

    const enriched = payments.map((appym) => {
      const vendorId = String(getRawField(appym, ['idvend', 'IDVEND'], '')).trim();
      const bankDetails = normalizeVenbank(venbankByVendor.get(vendorId));
      const cntbtch = getRawField(appym, ['cntbtch', 'CNTBTCH'], '');
      const cntitem = getRawField(appym, ['cntitem', 'CNTITEM'], '');
      const remarks = aptcrMap.get(`${cntbtch}|${cntitem}`) || '';
      return normalizePayment(appym, bankDetails, remarks);
    });

    return NextResponse.json({ success: true, data: enriched, seededVendorCount });
  } catch (error: unknown) {
    console.error('Error fetching posted payments:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to fetch payments' }, { status: 500 });
  }
}
