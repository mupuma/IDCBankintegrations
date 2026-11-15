import { transactionHealth } from '@/app/lib/transactionHealth';

export default function TransactionHealth({ status, error }: { status: string; error?: string | null }) {
  const health = transactionHealth(status, error);
  return <span className={health.tone === 'healthy' ? 'font-bold text-emerald-700' : health.tone === 'error' ? 'text-rose-700' : 'text-slate-500'}>{health.text}</span>;
}
