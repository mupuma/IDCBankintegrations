import { QueryTypes, Transaction } from 'sequelize';
import { connectDatabase, getSequelize } from '@/app/lib/db';
import { PaymentQueueRequest } from '@/app/models/internal/PaymentQueueRequest';
import type { BankCode, PaymentsResponse } from '@/app/models/dtos';

export type ClaimedQueueItem = {
  queueId: string;
  paymentId: string;
  bankCode: BankCode;
  sourceBank?: string | null;
  payment: PaymentsResponse;
  attempts: number;
  lockedBy?: string | null;
};

const CLAIMABLE_STATUSES = ['queued'];

function parsePaymentPayload(payload: string): PaymentsResponse {
  return JSON.parse(payload) as PaymentsResponse;
}

export async function claimNextBankQueueItem(
  bankCode: BankCode,
  agentId: string,
): Promise<ClaimedQueueItem | null> {
  await connectDatabase();
  const sequelize = await getSequelize();

  return sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
    async (transaction) => {
      const rows = await sequelize.query<{ id: number }>(
        `
          SELECT id
          FROM payment_queue_requests
          WHERE bank_code = :bankCode
            AND status IN (:statuses)
            AND (bank_code <> 'ZICB' OR payment_payload NOT LIKE '%"h2hProtocol":"h2h-v1"%')
          ORDER BY created_at ASC, id ASC
          LIMIT 1
          FOR UPDATE
        `,
        {
          replacements: { bankCode, statuses: CLAIMABLE_STATUSES },
          type: QueryTypes.SELECT,
          transaction,
        },
      );

      const id = rows[0]?.id;
      if (!id) {
        return null;
      }

      const now = new Date();
      await PaymentQueueRequest.update(
        {
          status: 'processing',
          attempts: sequelize.literal('attempts + 1') as any,
          lockedBy: agentId,
          lockedAt: now,
          claimedAt: now,
          lastError: null,
        } as any,
        { where: { id }, transaction },
      );

      const record = await PaymentQueueRequest.findByPk(id, { transaction });
      if (!record) {
        return null;
      }

      return {
        queueId: record.queueId,
        paymentId: record.paymentId,
        bankCode: record.bankCode as BankCode,
        sourceBank: record.sourceBank ?? null,
        payment: parsePaymentPayload(record.paymentPayload),
        attempts: record.attempts,
        lockedBy: record.lockedBy ?? null,
      };
    },
  );
}

export async function reportBankQueueResult(
  queueId: string,
  updates: {
    status: 'queued' | 'processing' | 'success' | 'failed';
    response?: unknown;
    error?: string;
    agentId?: string;
    attempts?: number;
  },
) {
  await connectDatabase();

  const existing = await PaymentQueueRequest.findOne({ where: { queueId } });
  if (existing && JSON.parse(existing.paymentPayload)?.h2hProtocol === 'h2h-v1') {
    throw new Error('H2H payments must use authenticated H2H outcome reporting');
  }

  const statusUpdate: Record<string, unknown> = {
    status: updates.status,
    lastError: updates.error ?? null,
    ...(updates.attempts !== undefined ? { attempts: updates.attempts } : {}),
    ...(updates.response !== undefined ? { responsePayload: JSON.stringify(updates.response) } : {}),
  };

  if (updates.status === 'success' || updates.status === 'failed' || updates.status === 'queued') {
    statusUpdate.lockedBy = null;
    statusUpdate.lockedAt = null;
  } else if (updates.agentId) {
    statusUpdate.lockedBy = updates.agentId;
    statusUpdate.lockedAt = new Date();
  }

  const [count] = await PaymentQueueRequest.update(statusUpdate as any, { where: { queueId } });
  return count > 0;
}
