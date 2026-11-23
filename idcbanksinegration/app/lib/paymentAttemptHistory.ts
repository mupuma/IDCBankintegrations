import type { BankQueueItem, PreviousPaymentAttempt } from './bankQueue';

export function collapsePaidAttempts(items: Map<string, BankQueueItem>): BankQueueItem[] {
  const superseded = new Set<string>();
  const visible = Array.from(items.values(), item => {
    if (item.status !== 'paid' && item.status !== 'success') return item;

    const history: PreviousPaymentAttempt[] = [];
    const seen = new Set([item.id]);
    let attempt = item;
    while (attempt.payment && typeof attempt.payment === 'object'
      && 'recoveryOf' in attempt.payment && typeof attempt.payment.recoveryOf === 'string') {
      const previous = items.get(attempt.payment.recoveryOf);
      if (!previous || previous.paymentId !== item.paymentId || previous.bankCode !== item.bankCode
        || previous.sourceBank !== item.sourceBank || seen.has(previous.id)) break;
      seen.add(previous.id);
      const { id, status, lastError, processedAt, updatedAt } = previous;
      history.unshift({ id, status, lastError, processedAt, updatedAt });
      if (status === 'failed' || status === 'rejected') superseded.add(id);
      attempt = previous;
    }
    return history.length ? { ...item, previousAttempts: history } : item;
  });
  return visible.filter(item => !superseded.has(item.id));
}
