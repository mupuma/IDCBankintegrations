import { Op } from 'sequelize';
import type { BankCode } from '@/app/models/dtos';
import { PaymentQueueRequest } from '@/app/models/internal/PaymentQueueRequest';
import { IzbPayment } from '@/app/models/internal/IzbPayment';

const ACTIVE_QUEUE_STATUSES = ['queued', 'processing', 'success'];
const ACTIVE_IZB_STATUSES = ['queued', 'processing', 'success', 'pulled'];

export interface ExistingPaymentPost {
  source: 'bank_queue' | 'izb_pending';
  queueId?: string;
  status: string;
  bankCode: BankCode;
}

export function resolvePaymentId(payment: { paymentId?: string }, fallbackQueueId?: string): string {
  return String(payment.paymentId || fallbackQueueId || '').trim();
}

export function buildAlreadyPostedMessage(
  existingPost: ExistingPaymentPost,
  requestedBankCode?: BankCode,
): string {
  const postedBank = existingPost.bankCode;
  const target = existingPost.source === 'izb_pending' ? 'IZB pending payments' : `${postedBank} queue`;

  if (requestedBankCode && requestedBankCode !== postedBank) {
    return `Payment has already been posted to ${postedBank}. Each payment can only be sent to one bank.`;
  }

  return `Payment has already been posted to ${target}`;
}

export async function findExistingPaymentPost(
  paymentId: string,
): Promise<ExistingPaymentPost | null> {
  if (!paymentId) {
    return null;
  }

  const queueRecord = await PaymentQueueRequest.findOne({
    where: {
      paymentId,
      status: { [Op.in]: ACTIVE_QUEUE_STATUSES },
    },
    order: [['updated_at', 'DESC']],
  });

  if (queueRecord) {
    return {
      source: 'bank_queue',
      queueId: queueRecord.queueId,
      status: queueRecord.status,
      bankCode: queueRecord.bankCode as BankCode,
    };
  }

  const izbRecord = await IzbPayment.findOne({
    where: {
      paymentId,
      status: { [Op.in]: ACTIVE_IZB_STATUSES },
    },
    order: [['updated_at', 'DESC']],
  });

  if (izbRecord) {
    return {
      source: 'izb_pending',
      status: izbRecord.status,
      bankCode: 'IZB',
    };
  }

  return null;
}
