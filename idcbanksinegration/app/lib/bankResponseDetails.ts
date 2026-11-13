const REFERENCE_LABELS: Record<string, string> = {
  bankref: 'Bank reference', bankreference: 'Bank reference', tranrefno: 'Bank transaction reference',
  batchreference: 'Bank batch reference', prcnnumber: 'PRCN', externaltranref: 'External reference',
  transactionreference: 'Transaction reference', reference: 'Instruction reference',
};

export function bankResponseReferences(response: unknown) {
  const references: Array<{ label: string; value: string }> = [];
  const seen = new Set<string>();
  function visit(value: unknown, depth: number) {
    if (!value || typeof value !== 'object' || depth > 12) return;
    for (const [key, child] of Object.entries(value)) {
      const label = REFERENCE_LABELS[key.toLowerCase().replace(/[_-]/g, '')];
      if (label && (typeof child === 'string' || typeof child === 'number') && String(child).trim()) {
        const text = String(child).trim(), identity = `${label}:${text}`;
        if (!seen.has(identity)) { references.push({ label, value: text }); seen.add(identity); }
      }
      visit(child, depth + 1);
    }
  }
  visit(response, 0);
  return references;
}
