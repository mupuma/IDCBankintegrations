import { Op, type Transaction } from 'sequelize';
import type { BankCode } from '@/app/models/dtos';
import { PaymentQueueRequest } from '@/app/models/internal/PaymentQueueRequest';
import { IzbPayment } from '@/app/models/internal/IzbPayment';

const ACTIVE_QUEUE_STATUSES = ['queued', 'processing', 'success', 'submitting', 'accepted', 'unknown', 'paid', 'needs_review'];
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
  transaction?: Transaction,
): Promise<ExistingPaymentPost | null> {
  if (!paymentId) {
    return null;
  }

  const queueRecord = await PaymentQueueRequest.findOne({
    transaction,
    where: {
      paymentId,
      [Op.or]: [
        { status: { [Op.in]: ACTIVE_QUEUE_STATUSES } },
        // ZICB failure is not permission to create a new transfer identity.
        { bankCode: 'ZICB' },
      ],
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
    transaction,
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
