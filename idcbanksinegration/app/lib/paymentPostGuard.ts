import { Op, type Transaction } from 'sequelize';
import type { BankCode } from '@/app/models/dtos';
import { PaymentQueueRequest } from '@/app/models/internal/PaymentQueueRequest';

const ACTIVE_QUEUE_STATUSES = ['queued', 'processing', 'success', 'submitting', 'accepted', 'unknown', 'paid', 'needs_review'];

export interface ExistingPaymentPost {
  source: 'bank_queue';
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
  const target = `${postedBank} queue`;

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

  return null;
}
