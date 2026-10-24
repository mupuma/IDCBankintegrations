'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BankQueueItem } from '@/app/lib/bankQueue';

type Details = {
  transactionId: string; status: string; lastError: string;
  canRetry: boolean; message: string; processedDate?: string;
};

export default function IzbCashbookRecoveryDialog({ item, canRetry, onClose, onChange }: {
  item: BankQueueItem; canRetry: boolean; onClose(): void; onChange(): void;
}) {
  const [details, setDetails] = useState<Details | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    const response = await fetch(`/api/v1/izb/cashbook_recovery?queueId=${encodeURIComponent(item.id)}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to load the saved cashbook notification');
    setDetails(data);
  }, [item.id]);

  useEffect(() => { void load().catch(value => setError(value instanceof Error ? value.message : 'Unable to load cashbook details')); }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !canRetry || !details?.canRetry) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/v1/izb/cashbook_recovery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueId: item.id, reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Cashbook retry failed');
      setMessage(data.message);
    } catch (value) { setError(value instanceof Error ? value.message : 'Cashbook retry failed'); }
    finally {
      // Refresh after success or failure so a corrected connection can be
      // retried immediately and an already-completed posting stays disabled.
      try { await load(); } catch { setDetails(null); }
      onChange(); setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true" aria-labelledby="izb-cashbook-title">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <h2 id="izb-cashbook-title" className="text-xl font-bold text-slate-900">IZB cashbook recovery</h2>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border px-3 py-2 disabled:opacity-40">Close</button>
        </div>
        <p className="mt-3 text-sm text-slate-600">Retry Sage cashbook posting using the saved IZB notification. The original transaction reference and accounting details stay unchanged. This does not send another bank payment.</p>
        <p className="mt-2 text-sm text-slate-600">Sage uses the current posting date and accounting period.</p>
        {details ? <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
          <p>Transaction: <span className="font-mono">{details.transactionId}</span></p>
          <p>Cashbook status: <strong>{details.status}</strong></p>
          {details.lastError ? <p className={details.status === 'failed' ? 'text-rose-700' : 'text-slate-600'}>{details.lastError}</p> : null}
          <p>{details.message}</p>
        </div> : <p className="mt-4 text-sm text-slate-500">Cashbook details are unavailable or loading.</p>}
        {error ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
        {message ? <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}
        {canRetry && details?.canRetry ? <form onSubmit={submit} className="mt-4 space-y-4">
          <label className="block text-sm font-semibold">Reason for retry
            <textarea value={reason} onChange={event => setReason(event.target.value)} required minLength={10} maxLength={1000} disabled={busy} className="mt-1 block w-full rounded-xl border p-3" />
          </label>
          <button disabled={busy || reason.trim().length < 10} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Retrying cashbook...' : 'Retry cashbook now'}</button>
        </form> : !canRetry ? <p className="mt-4 text-sm text-slate-600">Cashbook posting permission is required to retry.</p> : null}
        <button type="button" disabled={busy} onClick={() => { setError(''); void load().catch(value => setError(String(value.message || value))); }} className="mt-4 rounded-xl border px-4 py-2 text-sm disabled:opacity-40">Refresh cashbook status</button>
        <p className="mt-4 text-xs text-slate-500">Retry requests and results are recorded in Audit Logs.</p>
      </div>
    </div>
  );
}
