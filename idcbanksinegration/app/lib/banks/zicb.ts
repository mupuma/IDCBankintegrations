import type { PaymentsResponse } from '../../models/dtos';
import { buildZicbPayload } from './payloadBuilders';
import { resolveSourceBank } from '@/app/lib/sourceAccounts';

export { resolveSourceBank };

function mergeZicbDefaults(payment: PaymentsResponse, source?: { name?: string | null }) {
  const p = { ...payment };

  if (source?.name) {
    p.accountName = p.accountName || source.name;
  }

  if (!p.transactionDate) p.transactionDate = new Date();
  return p;
}

export async function createZicbPayload(payment: PaymentsResponse, sourceBank?: string | null) {
  const src = sourceBank ? await resolveSourceBank(sourceBank) : null;
  return buildZicbPayload(mergeZicbDefaults(payment, src || undefined), payment.transactionType, src || undefined);
}

export async function sendZicbPayment(payment: PaymentsResponse, queueId?: string, sourceBank?: string | null) {
  void payment;
  void queueId;
  void sourceBank;
  throw new Error('ZICB legacy dispatch has been removed. Submit ZICB payments through the H2H ledger.');
}
