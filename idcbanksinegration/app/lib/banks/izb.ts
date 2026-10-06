import type { PaymentsResponse } from '../../models/dtos';
import { buildIzbPayload } from './payloadBuilders';

export function createIzbPayload(payment: PaymentsResponse, sourceBank?: { accountNumber?: string | null; transit?: string | null; name?: string | null }) {
  return buildIzbPayload(payment, payment.transactionType, sourceBank);
}
