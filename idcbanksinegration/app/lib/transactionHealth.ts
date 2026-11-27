export function transactionHealth(status: string, error?: string | null) {
  if (error?.trim()) return { text: error, tone: 'error' as const };
  if (status === 'awaiting_approval') return { text: 'Awaiting approval', tone: 'pending' as const };
  if (status === 'approval_rejected') return { text: 'Rejected at approval', tone: 'error' as const };
  if (['success', 'paid'].includes(status)) return { text: 'OK!', tone: 'healthy' as const };
  if (['failed', 'rejected', 'needs_review', 'partially_completed', 'unknown'].includes(status)) {
    return { text: 'Needs attention', tone: 'error' as const };
  }
  return { text: 'Pending bank confirmation', tone: 'pending' as const };
}
