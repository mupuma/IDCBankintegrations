import type { BankCode } from '@/app/models/dtos';

export type SelectableSourceAccount = {
  bank: string;
  processingBank?: string | null;
  inactive?: number | null;
  isActive?: boolean;
};

const BANKS: BankCode[] = ['IZB', 'ZANACO', 'ZICB'];

export function processingBankFor(source: SelectableSourceAccount): BankCode | '' {
  // Only exact legacy integration codes are safe to infer. Custom Sage codes
  // must be assigned explicitly; account names are not reliable identifiers.
  const code = String(source.processingBank || source.bank || '').trim().toUpperCase();
  return BANKS.includes(code as BankCode) ? code as BankCode : '';
}

export function sourceAccountsForBank<T extends SelectableSourceAccount>(sources: T[], bank: string): T[] {
  if (!bank) return [];
  return sources.filter(source => source.isActive !== false && !source.inactive && processingBankFor(source) === bank);
}

export function sourceSelectionError(source: SelectableSourceAccount | undefined | null, bank: string): string | null {
  if (!source) return 'Select a source account for the selected bank.';
  if (source.isActive === false || source.inactive) return 'This source account is inactive. Select an active account.';
  if (processingBankFor(source) !== bank) return 'The source account does not belong to the selected bank. Assign its processing bank in Source Accounts.';
  return null;
}
