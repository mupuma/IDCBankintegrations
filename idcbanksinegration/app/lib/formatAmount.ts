// Display-only amount formatting. Never use this for CSV exports or for any
// value sent to the API or a bank: it rounds to 2 decimals and adds grouping.
const amountFormatter = new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatAmount(value: number | string | null | undefined, currency?: string | null): string {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  const formatted = amountFormatter.format(numeric);
  const code = (currency ?? '').trim();
  return code ? `${formatted} ${code}` : formatted;
}
