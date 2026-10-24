import type { BankQueueItem } from './bankQueue';

export const QUEUE_SEARCH_FIELDS = [
  { value: 'all', label: 'All fields' },
  { value: 'vendor', label: 'Vendor ID or name' },
  { value: 'reference', label: 'Payment or bank reference' },
  { value: 'transactionType', label: 'Transaction type' },
  { value: 'description', label: 'Description' },
  { value: 'status', label: 'Status' },
  { value: 'amount', label: 'Amount' },
  { value: 'currency', label: 'Currency' },
  { value: 'sourceBank', label: 'Source account code' },
] as const;
export type QueueSearchField = typeof QUEUE_SEARCH_FIELDS[number]['value'];

export function isQueueSearchField(value: string): value is QueueSearchField {
  return QUEUE_SEARCH_FIELDS.some(field => field.value === value);
}

const record = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
const normalize = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

function typeValues(value: unknown): unknown[] {
  const type = String(value ?? '').toUpperCase().replace(/^ZANACO_(BULK_)?/, '');
  if (['DDACCT', 'DDACC', 'DDAC'].includes(type)) return [value, 'DDACCT', 'DDACC', 'DDAC'];
  if (['INT', 'INTERNAL'].includes(type)) return [value, 'INT', 'INTERNAL'];
  if (['TT', 'SWIFT'].includes(type)) return [value, 'TT', 'SWIFT'];
  return [value];
}

export function matchesQueueSearch(item: BankQueueItem, field: QueueSearchField, search: string): boolean {
  const query = normalize(search);
  if (!query) return true;
  const payment = record(item.payment), request = record(payment.request), meta = record(payment.meta);
  const response = record(item.response), data = record(response.data), bankResponse = record(response.response || data.response);
  const children = Array.isArray(request.items) ? request.items.map(record) : [];
  const values: Record<Exclude<QueueSearchField, 'all'>, unknown[]> = {
    vendor: [payment.vendorId, payment.accountName, payment.name, payment.customerNo,
      request.vendorId, request.name, request.accountName, request.beneName, request.customerId, request.customerNo,
      ...children.flatMap(child => [child.vendorId, child.accountName, child.name])],
    reference: [item.id, item.paymentId, payment.transactionId, payment.transactionReference, payment.externalTranRef,
      payment.reference, request.externalTranRef, request.batchName, request.reference,
      request.transferRef, request.transactionReference, request.transactionId,
      response.transactionId, response.reference, response.prcn_number, response.bankRef, response.batchId,
      data.batchReference, data.bankRef, data.tranRefNo,
      bankResponse.batchReference, bankResponse.externalTranRef, bankResponse.tranRefNo,
      ...(Array.isArray(meta.paymentIds) ? meta.paymentIds : []),
      ...children.flatMap(child => [child.externalTranRef, child.transactionId, child.transactionReference])],
    transactionType: [payment.transactionType, meta.transactionType, request.transferType, request.transferTyp, payment.service].flatMap(typeValues),
    description: [payment.remarks, payment.description, request.description, request.narration, request.remarks,
      ...children.flatMap(child => [child.remarks, child.description, child.narration])],
    status: [item.status],
    amount: [payment.amount, request.amount, request.totalAmount, ...children.map(child => child.amount)],
    currency: [payment.currency, payment.currencyCode, request.currency, request.payCurrency],
    sourceBank: [item.sourceBank],
  };
  const selected = field === 'all' ? [...Object.values(values).flat(), item.bankCode] : values[field];
  const numericQuery = query.replace(/,/g, '');
  return selected.some(value => normalize(value).includes(query))
    || (['all', 'amount'].includes(field) && /^\d+(?:\.\d*)?$/.test(numericQuery)
      && values.amount.some(value => normalize(value).includes(numericQuery)));
}
