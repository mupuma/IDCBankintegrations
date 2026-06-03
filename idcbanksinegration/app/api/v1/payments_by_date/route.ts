import { verifySessionToken } from '@/app/api/auth/login/middleware/auth';
import { connectSageDatabase } from '@/app/lib/sageDb';
import { PaymentsResponse, PaymentsRequest } from '@/app/models/dtos';
import { Appym } from '@/app/models/sage_entities/Appym';
import { Aptcr } from '@/app/models/sage_entities/Aptcr';
import { Venbank } from '@/app/models/sage_entities/Venbank';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Op } from 'sequelize';

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

function getRawField<T = any>(record: any, keys: string[], fallback: T): T {
  if (!record) return fallback;

  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }

  return fallback;
}

function normalizePayment(appym: any, bank: any, remarks: string): PaymentsResponse & { paymentId: string; bankDetailsFound: boolean } {
  const bankDetails = bank ? normalizeVenbank(bank) : null;
  const idbank = String(getRawField(appym, ['idbank', 'IDBANK'], '')).trim();
  const vendorId = String(getRawField(appym, ['idvend', 'IDVEND'], '')).trim();
  const idrmit = String(getRawField(appym, ['idrmit', 'IDRMIT'], '')).trim();
  const longserial = String(getRawField(appym, ['longserial', 'LONGSERIAL'], '')).trim();

  return {
    accountNumber: String(getRawField(bankDetails, ['accven', 'ACCVEN'], '')).trim(),
    amount: Number(getRawField(appym, ['amtpaym', 'AMTPAYM'], 0)),
    currency: String(getRawField(appym, ['codecurn', 'CODECURN'], '')).trim(),
    currencyCode: String(getRawField(appym, ['codecurn', 'CODECURN'], '')).trim(),
    remarks,
    vendorId,
    accountName: String(getRawField(bankDetails, ['accname', 'ACCNAME'], '')).trim(),
    branchCode: String(getRawField(bankDetails, ['brnch', 'BRNCH'], '')).trim(),
    sortCode: String(getRawField(bankDetails, ['sortcde', 'SORTCDE'], '')).trim(),
    swiftCode: String(getRawField(bankDetails, ['swiftcde', 'SWIFTCDE'], '')).trim(),
    bankName: String(getRawField(bankDetails, ['bankid', 'BANKID'], '')).trim(),
    email: String(getRawField(bankDetails, ['email', 'EMAIL'], '')).trim(),
    phoneNumber: String(getRawField(bankDetails, ['phoneNumber', 'PHONE_NUMBER'], '')).trim(),
    physicalAddress: bankDetails?.physicalAddress || { streetName: '', town: '', plotNo: '' },
    countryOfOrigin: String(getRawField(bankDetails, ['countryOfOrigin', 'COUNTRY_OF_ORIGIN'], '')).trim(),
    currencyCde: String(getRawField(appym, ['codecurn', 'CODECURN'], '')).trim(),
    transactionDate: parseNumericDate(getRawField(appym, ['datebus', 'DATEBUS'], getRawField(appym, ['datermit', 'DATERMIT'], 0))),
    transactionType: mapTransactionType(String(getRawField(appym, ['paymcode', 'PAYMCODE'], ''))),
    transactionReference: String(remarks || idrmit || idbank || longserial).trim(),
    paymentId: `${idbank || 'UNK'}|${vendorId || 'UNK'}|${idrmit || 'UNK'}|${longserial || 'UNK'}`,
    bankDetailsFound: Boolean(bankDetails),
  };
}

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get('session')?.value;
  const user = await verifySessionToken(sessionToken);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
    });

    const vendorIds = Array.from(
      new Set(
        payments
          .map((item) => String(getRawField(item, ['idvend', 'IDVEND'], '')).trim())
          .filter(Boolean)
      )
    );

    const bankRows = await Venbank.findAll({
      where: {
        vendorid: {
          [Op.in]: vendorIds,
        },
      },
      raw: true,
    });

    const bankMap = new Map<string, any>();
    bankRows.forEach((bank) => {
      bankMap.set(String(getRawField(bank, ['vendorid', 'VENDORID'], '')).trim(), bank);
    });

    const aptcrPairs = new Set<string>();
    const aptcrSearch: any[] = [];
    payments.forEach((item) => {
      const cntbtch = getRawField(item, ['cntbtch', 'CNTBTCH'], null);
      const cntitem = getRawField(item, ['cntitem', 'CNTITEM'], null);
      if (cntbtch != null && cntitem != null) {
        const key = `${cntbtch}|${cntitem}`;
        if (!aptcrPairs.has(key)) {
          aptcrPairs.add(key);
          aptcrSearch.push({ cntbtch, cntentr: cntitem });
        }
      }
    });

    const aptcrRows = aptcrSearch.length
      ? await Aptcr.findAll({
          where: {
            [Op.or]: aptcrSearch,
          },
          raw: true,
        })
      : [];

    const aptcrMap = new Map<string, string>();
    aptcrRows.forEach((row) => {
      const key = `${getRawField(row, ['cntbtch', 'CNTBTCH'], '')}|${getRawField(row, ['cntentr', 'CNTENTR'], '')}`;
      const value = String(getRawField(row, ['textrmit', 'TEXTRMIT'], '')).trim();
      if (key) aptcrMap.set(key, value);
    });

    const enriched = payments.map((appym) => {
      const vendorId = String(getRawField(appym, ['idvend', 'IDVEND'], '')).trim();
      const cntbtch = getRawField(appym, ['cntbtch', 'CNTBTCH'], '');
      const cntitem = getRawField(appym, ['cntitem', 'CNTITEM'], '');
      const remarks = aptcrMap.get(`${cntbtch}|${cntitem}`) || '';
      return normalizePayment(appym, bankMap.get(vendorId), remarks);
    });

    return NextResponse.json({ success: true, data: enriched });
  } catch (error: any) {
    console.error('Error fetching posted payments:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch payments' }, { status: 500 });
  }
}
