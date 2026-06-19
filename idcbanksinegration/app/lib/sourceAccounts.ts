import { connectDatabase } from '@/app/lib/db';
import { connectSageDatabase } from '@/app/lib/sageDb';
import { SourceAccount } from '@/app/models/internal/SourceAccount';
import { Bkacct } from '@/app/models/sage_entities/Bkacct';

export type SourceBankRecord = {
  bank: string;
  name: string | null;
  accountNumber: string | null;
  addr1?: string | null;
  addr2?: string | null;
  addr3?: string | null;
  addr4?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal?: string | null;
  contact?: string | null;
  phone?: string | null;
  fax?: string | null;
  transit: string | null;
  idacct?: string | null;
  inactive?: number | null;
  hasLocalDetails: boolean;
  detailsComplete: boolean;
};

function normalize(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value).trim();
  return '';
}

function pickValue(localValue: unknown, sageValue: unknown): string {
  const local = normalize(localValue);
  if (local) return local;
  return normalize(sageValue);
}

function mapSageRow(row: Record<string, unknown>) {
  return {
    bank: normalize(row.BANK ?? row.bank),
    name: normalize(row.NAME ?? row.name) || null,
    accountNumber: normalize(row.BKACCT ?? row.bkacct) || null,
    addr1: normalize(row.ADDR1 ?? row.addr1) || null,
    addr2: normalize(row.ADDR2 ?? row.addr2) || null,
    addr3: normalize(row.ADDR3 ?? row.addr3) || null,
    addr4: normalize(row.ADDR4 ?? row.addr4) || null,
    city: normalize(row.CITY ?? row.city) || null,
    state: normalize(row.STATE ?? row.state) || null,
    country: normalize(row.COUNTRY ?? row.country) || null,
    postal: normalize(row.POSTAL ?? row.postal) || null,
    contact: normalize(row.CONTACT ?? row.contact) || null,
    phone: normalize(row.PHONE ?? row.phone) || null,
    fax: normalize(row.FAX ?? row.fax) || null,
    transit: normalize(row.TRANSIT ?? row.transit) || null,
    idacct: normalize(row.IDACCT ?? row.idacct) || null,
    inactive: (row.INACTIVE ?? row.inactive ?? null) as number | null,
  };
}

function mapLocalRow(row: SourceAccount) {
  return {
    bank: normalize(row.bank),
    name: normalize(row.name) || null,
    accountNumber: normalize(row.accountNumber) || null,
    branchCode: normalize(row.branchCode) || null,
    contact: normalize(row.contact) || null,
    phone: normalize(row.phone) || null,
    isActive: row.isActive !== false,
    notes: normalize(row.notes) || null,
  };
}

function hasLocalPaymentDetails(local?: ReturnType<typeof mapLocalRow> | null) {
  if (!local) return false;
  return Boolean(local.accountNumber || local.branchCode || local.name);
}

function isDetailsComplete(record: Pick<SourceBankRecord, 'accountNumber' | 'transit' | 'name'>) {
  return Boolean(normalize(record.accountNumber) && normalize(record.transit) && normalize(record.name));
}

export function mergeSourceRecords(
  sage?: ReturnType<typeof mapSageRow> | null,
  local?: ReturnType<typeof mapLocalRow> | null,
): SourceBankRecord | null {
  if (!sage && !local) return null;

  const bank = normalize(local?.bank || sage?.bank);
  if (!bank) return null;

  const accountNumber = pickValue(local?.accountNumber, sage?.accountNumber) || null;
  const transit = pickValue(local?.branchCode, sage?.transit) || null;
  const name = pickValue(local?.name, sage?.name) || null;

  const record: SourceBankRecord = {
    bank,
    name,
    accountNumber,
    transit,
    addr1: sage?.addr1 ?? null,
    addr2: sage?.addr2 ?? null,
    addr3: sage?.addr3 ?? null,
    addr4: sage?.addr4 ?? null,
    city: sage?.city ?? null,
    state: sage?.state ?? null,
    country: sage?.country ?? null,
    postal: sage?.postal ?? null,
    contact: pickValue(local?.contact, sage?.contact) || null,
    phone: pickValue(local?.phone, sage?.phone) || null,
    fax: sage?.fax ?? null,
    idacct: sage?.idacct ?? null,
    inactive: sage?.inactive ?? null,
    hasLocalDetails: hasLocalPaymentDetails(local),
    detailsComplete: isDetailsComplete({ accountNumber, transit, name }),
  };

  return record;
}

export async function resolveSourceBank(bankCode?: string | null) {
  if (!bankCode) return null;

  const code = normalize(bankCode).toUpperCase();
  if (!code) return null;

  let sageRow: ReturnType<typeof mapSageRow> | null = null;
  let localRow: ReturnType<typeof mapLocalRow> | null = null;

  try {
    await connectSageDatabase();
    const bk = await Bkacct.findOne({ where: { bank: code } });
    if (bk) {
      const raw = (bk as { toJSON?: () => Record<string, unknown> }).toJSON
        ? (bk as { toJSON: () => Record<string, unknown> }).toJSON()
        : (bk as unknown as Record<string, unknown>);
      sageRow = mapSageRow(raw);
    }
  } catch (err) {
    console.warn('Failed to load Sage source bank', err);
  }

  try {
    await connectDatabase();
    const local = await SourceAccount.findOne({ where: { bank: code } });
    if (local && local.isActive !== false) {
      localRow = mapLocalRow(local);
    }
  } catch (err) {
    console.warn('Failed to load local source account', err);
  }

  return mergeSourceRecords(sageRow, localRow);
}

export async function listSourceBanks() {
  const localByBank = new Map<string, ReturnType<typeof mapLocalRow>>();
  const sageRows: ReturnType<typeof mapSageRow>[] = [];

  try {
    await connectDatabase();
    const locals = await SourceAccount.findAll({ order: [['bank', 'ASC']] });
    for (const row of locals) {
      if (row.isActive === false) continue;
      const mapped = mapLocalRow(row);
      if (mapped.bank) localByBank.set(mapped.bank.toUpperCase(), mapped);
    }
  } catch (err) {
    console.warn('Failed to load local source accounts', err);
  }

  try {
    await connectSageDatabase();
    const banks = await Bkacct.findAll({ where: { inactive: 0 }, limit: 500 });
    for (const bank of banks) {
      const raw = (bank as { toJSON?: () => Record<string, unknown> }).toJSON
        ? (bank as { toJSON: () => Record<string, unknown> }).toJSON()
        : (bank as unknown as Record<string, unknown>);
      const mapped = mapSageRow(raw);
      if (mapped.bank) sageRows.push(mapped);
    }
  } catch (err) {
    console.warn('Failed to load Sage source banks', err);
  }

  const merged = new Map<string, SourceBankRecord>();

  for (const sage of sageRows) {
    const key = sage.bank.toUpperCase();
    const local = localByBank.get(key) ?? null;
    const record = mergeSourceRecords(sage, local);
    if (record) merged.set(key, record);
    localByBank.delete(key);
  }

  for (const local of localByBank.values()) {
    const record = mergeSourceRecords(null, local);
    if (record) merged.set(record.bank.toUpperCase(), record);
  }

  return Array.from(merged.values()).sort((a, b) => a.bank.localeCompare(b.bank));
}

export function serializeSourceAccount(row: SourceAccount) {
  const mapped = mapLocalRow(row);
  return {
    id: row.id,
    bank: mapped.bank,
    name: mapped.name,
    accountNumber: mapped.accountNumber,
    branchCode: mapped.branchCode,
    contact: mapped.contact,
    phone: mapped.phone,
    isActive: mapped.isActive,
    notes: mapped.notes,
    detailsComplete: isDetailsComplete({
      accountNumber: mapped.accountNumber,
      transit: mapped.branchCode,
      name: mapped.name,
    }),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
