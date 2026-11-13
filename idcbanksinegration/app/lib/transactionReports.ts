import { bankResponseReferences } from './bankResponseDetails';

export const REPORT_STATUSES = ['success', 'paid', 'failed', 'rejected', 'partially_completed', 'needs_review', 'accepted', 'unknown', 'queued', 'pulled', 'processing', 'submitting'];
export type ReportFilters = {
  groupBy: 'day' | 'month' | 'year'; dateBasis: 'processed' | 'created' | 'payment';
  from: string; to: string; bank: string; status: string; sourceBank: string;
  currency: string; transactionType: string; vendor: string; account: string;
  reference: string; search: string; minAmount: string; maxAmount: string; missingReference: string;
};
export type SavedReportPayment = {
  id: number | string; queueId: string; paymentId: string; bankCode: string; sourceBank?: string | null;
  paymentPayload: string; responsePayload?: string | null; status: string; attempts: number;
  lastError?: string | null; createdAt: Date | string; updatedAt: Date | string;
};
export type ReportRow = {
  rowId: string; queueId: string; paymentId: string; bank: string; sourceBank: string; sageBankCode: string;
  vendorId: string; beneficiary: string; account: string; debitAccount: string; amount: string; currency: string;
  transactionType: string; status: string; statusScope: string; bankStatus: string; bankReferences: string;
  references: string; description: string; createdAt: string; processedAt: string; paymentDate: string;
  reportDate: string; dateSource: string; error: string; attempts: number; dataQuality: string;
  payment: Record<string, any>; response: Record<string, any>; parentPaymentId: string; bulk: boolean;
};
const text = (v: unknown) => String(v ?? '').trim();
const normalized = (v: unknown) => text(v).toLowerCase();
const dateFormatter = new Intl.DateTimeFormat('en', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' });
const object = (v: unknown): Record<string, any> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : {};
function parse(value: string | null | undefined) {
  try { const parsed = JSON.parse(value || '{}'); const invalid = !parsed || typeof parsed !== 'object' || Array.isArray(parsed); return { value: invalid ? { unparsedPayload: value } : object(parsed), invalid }; }
  catch { return { value: { unparsedPayload: value }, invalid: true }; }
}
export function localReportDate(value: unknown): string {
  const raw = text(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return validDate(raw) ? raw : '';
  if (/^\d{8}$/.test(raw)) return localReportDate(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`);
  const date = new Date(raw);
  if (!raw || !Number.isFinite(date.getTime())) return '';
  const parts = dateFormatter.formatToParts(date);
  const part = (key: string) => parts.find(item => item.type === key)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function iso(value: unknown) { const date = new Date(text(value)); return Number.isFinite(date.getTime()) ? date.toISOString() : ''; }
function validDate(value: string) { const date = new Date(`${value}T00:00:00Z`); return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value; }
export function parseReportFilters(params: URLSearchParams): ReportFilters {
  const result: any = {};
  const defaults = { groupBy: 'day', dateBasis: 'processed', from: '', to: '', bank: '', status: 'completed', sourceBank: '', currency: '', transactionType: '', vendor: '', account: '', reference: '', search: '', minAmount: '', maxAmount: '', missingReference: '' };
  for (const [key, fallback] of Object.entries(defaults)) {
    result[key] = (params.get(key) ?? fallback).trim();
    if (result[key].length > 250) throw new Error(`Filter ${key} is too long`);
  }
  if (!['day', 'month', 'year'].includes(result.groupBy) || !['processed', 'created', 'payment'].includes(result.dateBasis)) throw new Error('Invalid report period or date basis');
  for (const key of ['from', 'to']) if (result[key] && !validDate(result[key])) throw new Error('Dates must be valid YYYY-MM-DD values');
  if (result.from && result.to && result.from > result.to) throw new Error('From date must be on or before To date');
  if (result.bank && !['IZB', 'ZICB', 'ZANACO'].includes(result.bank)) throw new Error('Invalid bank');
  if (!['completed', 'final', 'all', ...REPORT_STATUSES].includes(result.status)) throw new Error('Invalid report status');
  if (!['', 'yes', 'no'].includes(result.missingReference)) throw new Error('Invalid bank-reference filter');
  for (const key of ['minAmount', 'maxAmount']) if (result[key] && (!/^\d+(\.\d{1,6})?$/.test(result[key]) || !Number.isFinite(Number(result[key])))) throw new Error('Amounts must be non-negative numbers with up to six decimals');
  if (result.minAmount && result.maxAmount && Number(result.minAmount) > Number(result.maxAmount)) throw new Error('Minimum amount exceeds maximum amount');
  return result;
}

function reportTransactionType(value: unknown) {
  const type = text(value).toUpperCase().replace(/^ZANACO_(BULK_)?/, '');
  return ['DDAC', 'DDACC', 'DDACCT'].includes(type) ? 'DDACCT' : type === 'SWIFT' ? 'TT' : type === 'INTERNAL' ? 'INT' : type;
}

export function reportRows(record: SavedReportPayment, filters: ReportFilters): ReportRow[] {
  const parsed = parse(record.paymentPayload), reply = parse(record.responsePayload);
  const payment = parsed.value, response = reply.value, request = object(payment.request), meta = object(payment.meta);
  const bulk = Array.isArray(request.items) && request.items.length > 0;
  const children = bulk ? request.items : [payment];
  const refs = bankResponseReferences(response);
  const bankReferences = refs.filter(ref => ref.label.startsWith('Bank')).map(ref => ref.value).join(' | ');
  const recorded = response.outcomeRecordedAt || response.processedAt || response.receivedAt || response.completedAt;
  const processedAt = iso(recorded) || iso(record.updatedAt);
  return children.map((child: unknown, index: number) => {
    const item = object(child), details = bulk ? item : { ...request, ...payment };
    const original = bulk ? object(meta.payments?.[index] || meta.sagePayments?.[index]) : payment;
    const amount = details.amount ?? (bulk ? undefined : request.amount);
    const validAmount = /^[+-]?\d+(?:\.\d*)?(?:e[+-]?\d+)?$/i.test(text(amount)) && amount !== null && amount !== undefined && text(amount) !== '' && Number.isFinite(Number(amount));
    const paymentDate = localReportDate(details.transactionDate || details.valueDate || request.valueDate);
    const dateSource = filters.dateBasis === 'created' ? 'Queued date' : filters.dateBasis === 'payment' ? 'Payment/value date'
      : iso(recorded) && response.outcomeDateSource !== 'historical' ? 'Local bank outcome recorded' : 'Last update (historical fallback)';
    const reportDate = filters.dateBasis === 'created' ? localReportDate(record.createdAt) : filters.dateBasis === 'payment' ? paymentDate : localReportDate(processedAt);
    const issues = [parsed.invalid ? 'Invalid saved payment JSON' : '', reply.invalid ? 'Invalid saved response JSON' : '', !validAmount ? 'Amount missing/invalid; excluded from monetary totals' : '', !reportDate ? 'Date missing/invalid' : '', bulk ? 'Status and bank references apply to the batch; individual settlement is not inferred' : ''].filter(Boolean);
    return {
      rowId: `${record.queueId}:${index}`, queueId: record.queueId,
      paymentId: text(original.paymentId || meta.paymentIds?.[index] || details.paymentId || details.externalTranRef || record.paymentId),
      parentPaymentId: record.paymentId, bank: record.bankCode, sourceBank: text(record.sourceBank),
      sageBankCode: text(original.sageBankCode), vendorId: text(original.vendorId || details.vendorId),
      beneficiary: text(details.accountName || details.name || details.beneName),
      account: text(details.accountNumber || details.creditAccount || details.beneficiaryAccount),
      debitAccount: text(details.srcAcc || details.debitAccount || request.debitAccount),
      amount: validAmount ? text(amount) : '', currency: text(details.currency || details.currencyCode || details.ccy || request.currency || request.ccy).toUpperCase(),
      transactionType: reportTransactionType(details.transactionType || meta.transactionType || request.transferType || payment.service),
      status: record.status, statusScope: bulk ? 'Batch' : 'Payment', bankStatus: text(response.bankStatus || response.bankStatusCode || response.rawStatus),
      bankReferences, references: [...refs.map(ref => `${ref.label}: ${ref.value}`), text(details.transactionId), text(details.transactionReference), text(details.externalTranRef)].filter(Boolean).join(' | '),
      description: text(details.remarks || details.description || details.paymentDetails || details.narration || request.description),
      createdAt: iso(record.createdAt), processedAt, paymentDate, reportDate, dateSource,
      error: text(record.lastError || response.error), attempts: record.attempts,
      dataQuality: issues.join('; '), payment: bulk ? { ...details, originalPayment: original, batch: payment } : payment, response, bulk,
    };
  });
}

export function matchesReport(row: ReportRow, filters: ReportFilters) {
  if (filters.status === 'completed' && !['paid', 'success'].includes(row.status)) return false;
  if (filters.status === 'final' && !['paid', 'success', 'failed', 'rejected', 'partially_completed'].includes(row.status)) return false;
  if (!['completed', 'final', 'all'].includes(filters.status) && filters.status !== row.status) return false;
  if (filters.bank && filters.bank !== row.bank) return false;
  if ((filters.from || filters.to) && !row.reportDate) return false;
  if (filters.from && row.reportDate < filters.from || filters.to && row.reportDate > filters.to) return false;
  for (const key of ['sourceBank', 'currency', 'transactionType'] as const) if (filters[key] && normalized(row[key]) !== normalized(filters[key])) return false;
  for (const [filter, value] of [['vendor', `${row.vendorId} ${row.beneficiary}`], ['account', `${row.account} ${row.debitAccount}`], ['reference', `${row.queueId} ${row.paymentId} ${row.parentPaymentId} ${row.references}`]] as const) {
    if (filters[filter] && !normalized(value).includes(normalized(filters[filter]))) return false;
  }
  if (filters.missingReference === 'yes' && row.bankReferences || filters.missingReference === 'no' && !row.bankReferences) return false;
  if (filters.minAmount && (!row.amount || Number(row.amount) < Number(filters.minAmount))) return false;
  if (filters.maxAmount && (!row.amount || Number(row.amount) > Number(filters.maxAmount))) return false;
  if (filters.search && !normalized(JSON.stringify(row)).includes(normalized(filters.search))) return false;
  return true;
}

// Six decimal places match the maximum supported bank amountScale. Keep sums
// as integer micro-units so repeated decimal additions do not drift.
function micros(value: string) {
  const match = value.match(/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
  if (!match) throw new Error('Unsupported monetary value');
  const [, sign, whole, fraction = '', exponent = '0'] = match;
  const digits = BigInt(whole + fraction), shift = 6 + Number(exponent) - fraction.length;
  const divisor = BigInt(10) ** BigInt(Math.abs(shift));
  const amount = shift >= 0 ? digits * divisor : (digits + divisor / BigInt(2)) / divisor;
  return sign === '-' ? -amount : amount;
}
function decimal(value: bigint) {
  const negative = value < BigInt(0), absolute = negative ? -value : value, scale = BigInt(1000000);
  return `${negative ? '-' : ''}${absolute / scale}.${String(absolute % scale).padStart(6, '0')}`;
}

export function createReportSummary(groupBy: ReportFilters['groupBy']) {
  const totals = new Map<string, { period: string; bank: string; currency: string; status: string; count: number; amount: bigint; missingAmounts: number }>();
  return {
    add(row: ReportRow) {
      const period = row.reportDate ? row.reportDate.slice(0, groupBy === 'year' ? 4 : groupBy === 'month' ? 7 : 10) : 'Undated';
      const key = JSON.stringify([period, row.bank, row.currency, row.status]);
      const entry = totals.get(key) || { period, bank: row.bank, currency: row.currency || 'Unspecified', status: row.status, count: 0, amount: BigInt(0), missingAmounts: 0 };
      entry.count++; if (row.amount) entry.amount += micros(row.amount); else entry.missingAmounts++;
      totals.set(key, entry);
    },
    rows: () => [...totals.values()].map(entry => ({ ...entry, amount: decimal(entry.amount) })).sort((a, b) => a.period.localeCompare(b.period) || a.bank.localeCompare(b.bank) || a.currency.localeCompare(b.currency) || a.status.localeCompare(b.status)),
  };
}
export const REPORT_CSV_COLUMNS = ['queueId', 'paymentId', 'parentPaymentId', 'bank', 'sourceBank', 'sageBankCode', 'vendorId', 'beneficiary', 'account', 'debitAccount', 'amount', 'currency', 'transactionType', 'status', 'statusScope', 'bankStatus', 'bankReferences', 'references', 'description', 'createdAt', 'processedAt', 'paymentDate', 'reportDate', 'dateSource', 'error', 'attempts', 'dataQuality', 'payment', 'response'] as const;
export function csvCell(value: unknown) {
  let content = value && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
  if (/^[\s]*[=+@-]|^[\t\r\n]/.test(content)) content = `'${content}`;
  return `"${content.replace(/"/g, '""')}"`;
}
export function reportCsvRow(row: ReportRow) { return REPORT_CSV_COLUMNS.map(key => csvCell(row[key])).join(',') + '\r\n'; }
