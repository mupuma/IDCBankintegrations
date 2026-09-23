import type { PaymentsResponse } from '../../models/dtos';
import { sendIzbPayment } from './izb';
import { sendZanacoPayment } from './zanaco';

export type BankCode = 'IZB' | 'ZANACO' | 'ZICB';
export const BANK_CODES: BankCode[] = ['ZICB'];

export type BankQueueResult = {
  success: boolean;
  status: number;
  data?: unknown;
  error?: string;
  deferred?: boolean;
};

export async function sendPaymentToBank(
  bankCode: BankCode,
  payment: PaymentsResponse,
  queueId?: string,
  sourceBank?: string | null,
): Promise<BankQueueResult> {
  switch (bankCode) {
    case 'IZB':
      return sendIzbPayment(payment, sourceBank);
    case 'ZANACO':
      return sendZanacoPayment(payment, queueId, sourceBank);
    case 'ZICB':
      throw new Error('ZICB legacy dispatch has been removed. Submit ZICB payments through the H2H ledger.');
    default:
      throw new Error(`Unsupported bank code: ${String(bankCode)}`);
  }
}
