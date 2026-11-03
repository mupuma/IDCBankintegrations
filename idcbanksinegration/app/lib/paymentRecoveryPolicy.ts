export type RecoveryAction = 'retry_connection' | 'check_status' | 'retry_reporting' | 'retry_accounting' | 'new_attempt';
export type RecoveryEvidence = {
  protocol?: string; notSent?: boolean; retryable?: boolean; confirmedRejected?: boolean;
};
export function recoveryActions(bank: string, status: string, evidence: RecoveryEvidence = {}, accounting?: string) {
  const actions: RecoveryAction[] = [];
  if (!['ZANACO', 'ZICB'].includes(bank)) return actions;
  if (bank === 'ZICB' && status === 'paid') {
    if (['pending', 'retry', 'needs_review'].includes(accounting || '')) actions.push('retry_accounting');
    return actions;
  }
  if (['success', 'paid', 'queued'].includes(status)) return actions;
  if (bank === 'ZANACO' && ['processing', 'unknown', 'accepted', 'failed', 'rejected', 'needs_review'].includes(status)) actions.push('retry_reporting');
  if (!evidence.notSent && ['processing', 'submitting', 'unknown', 'accepted', 'needs_review', 'failed', 'rejected'].includes(status)) actions.push('check_status');
  if (evidence.notSent && evidence.retryable && ['failed', 'rejected', 'processing'].includes(status)) actions.push('retry_connection');
  if (['failed', 'rejected'].includes(status) && (evidence.confirmedRejected || (evidence.notSent && !evidence.retryable))) actions.push('new_attempt');
  return actions;
}

export function correctedPayment(original: Record<string, any>, corrections: unknown) {
  if (!corrections || typeof corrections !== 'object' || Array.isArray(corrections)) throw new Error('Corrections must be an object');
  const allowed = ['accountName', 'accountNumber', 'bankName', 'swiftCode', 'sortCode', 'tpin', 'purposeCode', 'sectorCode', 'physicalAddress'];
  const output = { ...original };
  for (const [key, value] of Object.entries(corrections)) {
    if (!allowed.includes(key)) throw new Error(`Cannot change ${key} when retrying a payment`);
    if (key === 'physicalAddress') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Physical address must be an object');
      const address = value as Record<string, unknown>;
      if (Object.keys(address).some(field => !['plotNo', 'streetName', 'town'].includes(field))) throw new Error('Unsupported address field');
      output.physicalAddress = Object.fromEntries(['plotNo', 'streetName', 'town'].map(field => [field, String(address[field] ?? '').trim()]));
    } else {
      if (typeof value !== 'string' || value.length > 255) throw new Error(`Invalid ${key}`);
      output[key] = value.trim();
      if (key === 'tpin') output.tpIn = output[key];
    }
  }
  return output;
}
