/** Versioned onboarding contract. Existing bank adapters retain their protocols. */
export const BANK_AGENT_PROTOCOL = 'bank-agent/v1' as const;
export type ConfigurationField = {
  key: string; label: string; type: 'string' | 'url' | 'integer' | 'boolean' | 'secret'; required: boolean;
};
export type AgentManifest = {
  protocol: typeof BANK_AGENT_PROTOCOL;
  bankCode: string; displayName: string; agentVersion: string;
  transactionTypes: string[];
  operations: Array<'submit' | 'claim' | 'validate' | 'status' | 'report' | 'accounting'>;
  configuration: ConfigurationField[];
};
export type PaymentInstruction = {
  protocol: typeof BANK_AGENT_PROTOCOL;
  queueId: string; instructionId: string; paymentId: string; bankCode: string;
  sourceAccountCode: string; transactionType: string; currency: string;
  /** Decimal string, never a floating-point total. */
  amount: string; valueDate: string;
  beneficiary: { accountNumber: string; name: string; bankCode?: string; attributes: Record<string, string> };
  reference: string;
};
export type AgentOutcome = {
  protocol: typeof BANK_AGENT_PROTOCOL;
  queueId: string; instructionId: string; eventId: string;
  status: 'accepted' | 'unknown' | 'paid' | 'rejected' | 'needs_review';
  bankReference?: string; message?: string;
  /** Only explicit, trusted evidence may permit another submission. */
  evidence?: { notSent?: boolean; confirmedRejected?: boolean };
};

export function validateManifest(input: unknown): string[] {
  const value = input as Partial<AgentManifest> | null;
  if (!value || typeof value !== 'object') return ['Manifest must be an object'];
  const errors: string[] = [];
  if (value.protocol !== BANK_AGENT_PROTOCOL) errors.push('Unsupported agent protocol');
  if (!/^[A-Z][A-Z0-9_]{1,19}$/.test(String(value.bankCode || ''))) errors.push('Invalid bank code');
  if (typeof value.displayName !== 'string' || !value.displayName.trim() || value.displayName.length > 120) errors.push('Bank display name is required');
  if (typeof value.agentVersion !== 'string' || !value.agentVersion.trim()) errors.push('Agent version is required');
  if (!Array.isArray(value.transactionTypes) || !value.transactionTypes.length || value.transactionTypes.some(type => typeof type !== 'string' || !/^[A-Z][A-Z0-9_]{0,31}$/.test(type))) errors.push('Valid transaction types are required');
  if (!Array.isArray(value.operations) || !value.operations.length || value.operations.some(operation => !['submit', 'claim', 'validate', 'status', 'report', 'accounting'].includes(operation))) errors.push('Valid agent operations are required');
  const keys = new Set<string>();
  if (!Array.isArray(value.configuration)) errors.push('Configuration requirements must be an array');
  else for (const field of value.configuration) {
    if (!field || typeof field !== 'object' || !/^[A-Z][A-Z0-9_]{0,99}$/.test(field.key)
      || keys.has(field.key) || typeof field.label !== 'string' || !field.label.trim()
      || !['string', 'url', 'integer', 'boolean', 'secret'].includes(field.type) || typeof field.required !== 'boolean'
      || Object.keys(field).some(key => !['key', 'label', 'type', 'required'].includes(key))) {
      errors.push('Invalid configuration requirement; manifests must not contain credential values');
    }
    if (field?.key) keys.add(field.key);
  }
  return errors;
}
