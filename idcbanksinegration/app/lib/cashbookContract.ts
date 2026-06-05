import type { ReceiptRequest } from '@/app/models/dtos';

function isEntryDetail(value: unknown): value is ReceiptRequest['entries'][number]['details'][number] {
  if (!value || typeof value !== 'object') return false;
  const detail = value as Record<string, unknown>;
  return (
    typeof detail.entryDescription === 'string' &&
    typeof detail.accountId === 'string' &&
    typeof detail.amount === 'number' &&
    typeof detail.DrCr === 'string' &&
    typeof detail.detailNo === 'number'
  );
}

function isEntry(value: unknown): value is ReceiptRequest['entries'][number] {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.entryNo === 'number' &&
    typeof entry.referenceNo === 'string' &&
    typeof entry.customerNo === 'string' &&
    typeof entry.noDetails === 'number' &&
    typeof entry.amount === 'number' &&
    typeof entry.currency === 'string' &&
    Array.isArray(entry.details) &&
    entry.details.every(isEntryDetail)
  );
}

export function normalizeReceiptRequest(body: unknown): ReceiptRequest | null {
  if (!body || typeof body !== 'object') return null;

  const record = body as Record<string, unknown>;
  const description = record.Description ?? record.description;
  const normalized = {
    transactionId: record.transactionId,
    bankCode: record.bankCode,
    description,
    noEntries: record.noEntries,
    creditAmount: record.creditAmount,
    debitAmount: record.debitAmount,
    entries: record.entries,
  };

  if (
    typeof normalized.transactionId !== 'string' ||
    typeof normalized.bankCode !== 'string' ||
    typeof normalized.description !== 'string' ||
    typeof normalized.noEntries !== 'number' ||
    typeof normalized.creditAmount !== 'number' ||
    typeof normalized.debitAmount !== 'number' ||
    !Array.isArray(normalized.entries) ||
    !normalized.entries.every(isEntry)
  ) {
    return null;
  }

  return {
    transactionId: normalized.transactionId,
    bankCode: normalized.bankCode,
    description: normalized.description,
    noEntries: normalized.noEntries,
    creditAmount: normalized.creditAmount,
    debitAmount: normalized.debitAmount,
    entries: normalized.entries,
  };
}

export function cashbookSavedResponse() {
  return { responseCode: 200, responseMessage: 'saved successfully' };
}

export function cashbookConflictResponse() {
  return { responseCode: 409, responseMessage: 'Already Reported' };
}

export function cashbookErrorResponse(message: string) {
  return { responseCode: 500, responseMessage: `Error processing transaction: ${message}` };
}

export function cashbookInvalidRequestResponse(message: string) {
  return {
    responseCode: '400',
    responseMessage: message,
    timeStamp: new Date().toISOString(),
  };
}
