import type { PaymentsResponse } from '../../models/dtos';
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
      return {
        success: true,
        status: 202,
        deferred: true,
        data: { message: 'IZB is pull-only. Payment remains queued until IZB pulls it.' },
      };
    case 'ZANACO':
      return sendZanacoPayment(payment, queueId, sourceBank);
    case 'ZICB':
      return sendZicbPayment(payment, queueId, sourceBank);
    default:
      throw new Error(`Unsupported bank code: ${String(bankCode)}`);
  }
}
