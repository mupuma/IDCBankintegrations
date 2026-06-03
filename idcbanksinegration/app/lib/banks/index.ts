import type { PaymentsResponse } from '../../models/dtos';
import { sendIzbPayment } from './izb';
import { sendZanacoPayment } from './zanaco';
import { sendZicbPayment } from './zicb';

export type BankCode = 'IZB' | 'ZANACO' | 'ZICB';
export const BANK_CODES: BankCode[] = ['IZB', 'ZANACO', 'ZICB'];

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
      return sendZanacoPayment(payment, sourceBank);
    case 'ZICB':
      return sendZicbPayment(payment, queueId, sourceBank);
    default:
      throw new Error(`Unsupported bank code: ${String(bankCode)}`);
  }
}
