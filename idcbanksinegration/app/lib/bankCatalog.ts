import type { BankCode } from '@/app/models/dtos';

// These adapters preserve the existing bank-specific validation and recovery.
// An unrecognised registry entry is a draft, never an executable integration.
export const BUILTIN_BANKS: Record<BankCode, { displayName: string; adapter: string; transactionTypes: string[] }> = {
  IZB: { displayName: 'Indo Zambia Bank', adapter: 'izb-pull', transactionTypes: ['INT', 'DDACCT', 'RTGS'] },
  ZICB: { displayName: 'Zambia Industrial Commercial Bank', adapter: 'zicb-h2h', transactionTypes: ['INT', 'DDACCT', 'RTGS'] },
  ZANACO: { displayName: 'Zanaco', adapter: 'zanaco-zws', transactionTypes: ['INT', 'DDACCT', 'RTGS', 'TT'] },
};
export function builtinBank(code: string) {
  return Object.hasOwn(BUILTIN_BANKS, code) ? BUILTIN_BANKS[code as BankCode] : undefined;
}
export type PublicBankIntegration = {
  bankCode: BankCode; displayName: string; enabled: boolean; transactionTypes: string[];
};
