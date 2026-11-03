'use client';

import { useEffect, useState } from 'react';
import type { BankQueueItem } from '@/app/lib/bankQueue';
import type { RecoveryAction } from '@/app/lib/paymentRecoveryPolicy';

const LABELS: Record<RecoveryAction, string> = {
  retry_connection: 'Retry connection (payment was not sent)',
  check_status: 'Check original bank status', retry_reporting: 'Report saved outcome again',
  retry_accounting: 'Retry accounting only', new_attempt: 'Submit a corrected new attempt',
};
const HELP: Record<RecoveryAction, string> = {
  retry_connection: 'Resume this instruction after fixing the connection or credentials. This is available only with recorded proof that no payment was sent.',
  check_status: 'Check the original bank reference. This does not send another payment.',
  retry_reporting: 'Send the outcome already saved by the agent to the portal. This does not contact the bank payment endpoint.',
  retry_accounting: 'Retry Sage accounting for an already paid payment. The bank payment is not repeated.',
  new_attempt: 'Create a new bank instruction after confirmed rejection or a validation failure before submission. The original instruction and audit history are preserved. Amount, currency, payment type and source account stay fixed.',
};
type Details = {
  status: string; actions: RecoveryAction[]; payment: Record<string, any>;
  evidence: { notSent?: boolean; confirmedRejected?: boolean };
  history: Array<{ id: string; action: RecoveryAction; status: string; requestedBy: string; reason: string; result: { message?: string; queueId?: string } }>;
};

export default function PaymentRecoveryDialog({ item, canRecover, canRetry, onClose, onChange }: {
  item: BankQueueItem; canRecover: boolean; canRetry: boolean; onClose(): void; onChange(): void;
}) {
  const [details, setDetails] = useState<Details | null>(null);
  const [action, setAction] = useState<RecoveryAction>('check_status');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [corrections, setCorrections] = useState<Record<string, string> | null>(null);
  const [actionId] = useState(() => {
    // getRandomValues also works on internal HTTP deployments where randomUUID
    // is unavailable because the browser does not consider the origin secure.
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(`/api/v1/payment_recovery?queueId=${encodeURIComponent(item.id)}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load recovery controls');
        setDetails(data);
        setCorrections(prev => prev ?? Object.fromEntries([
          'accountName', 'accountNumber', 'bankName', 'swiftCode', 'sortCode', 'tpin', 'purposeCode', 'sectorCode',
          'plotNo', 'streetName', 'town',
        ].map(field => [field, String(['plotNo', 'streetName', 'town'].includes(field)
          ? data.payment.physicalAddress?.[field] ?? '' : data.payment[field] ?? (field === 'tpin' ? data.payment.tpIn : '') ?? '')])));
      } catch (value) { if (!controller.signal.aborted) setError(value instanceof Error ? value.message : 'Unable to load recovery controls'); }
    };
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [item.id, refresh]);

  const available = (details?.actions || []).filter(value => value === 'new_attempt' ? canRetry : canRecover);
  const selected = available.includes(action) ? action : available[0];
  const pending = details?.history.some(entry => ['pending', 'processing'].includes(entry.status));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const fields = corrections || {};
      const response = await fetch('/api/v1/payment_recovery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueId: item.id, action: selected, actionId, reason, confirmed,
          corrections: selected === 'new_attempt' ? {
            ...Object.fromEntries(['accountName', 'accountNumber', 'bankName', 'swiftCode', 'sortCode', 'tpin', 'purposeCode', 'sectorCode'].map(field => [field, fields[field] || ''])),
            physicalAddress: { plotNo: fields.plotNo || '', streetName: fields.streetName || '', town: fields.town || '' },
          } : {} }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Recovery request failed');
      setMessage(data.message || 'Recovery request recorded. Its progress appears in the history below.');
      setRefresh(value => value + 1); onChange();
    } catch (value) { setError(value instanceof Error ? value.message : 'Recovery request failed'); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="recovery-title" className="text-xl font-bold text-slate-900">{item.bankCode} payment recovery</h2>
            <p className="mt-1 text-sm text-slate-600">Payment {item.paymentId} · Status: {details?.status || item.status}</p>
            <p className="mt-1 text-xs text-slate-500">Queue reference: {item.id}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-semibold">Close</button>
        </div>
        {error ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
        {message ? <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}
        {!details ? <p className="mt-4 text-sm">Loading recovery options...</p> : (
          <>
            <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              {details.evidence.notSent ? 'Recorded outcome: payment was not sent.' : details.evidence.confirmedRejected ? 'Recorded outcome: bank-confirmed rejection/failure.' : 'No proof authorising another payment is recorded. Recovery must preserve the original reference.'}
            </p>
            {pending ? <p className="mt-3 text-sm text-amber-800">A recovery action is waiting for the agent or is being processed.</p> : null}
            {selected ? (
              <form onSubmit={submit} className="mt-4 space-y-4">
                <label className="block text-sm font-semibold">Recovery action
                  <select value={selected} onChange={event => { setAction(event.target.value as RecoveryAction); setConfirmed(false); }} disabled={busy || pending || Boolean(message)} className="mt-1 block w-full rounded-xl border p-3">
                    {available.map(value => <option key={value} value={value}>{LABELS[value]}</option>)}
                  </select>
                </label>
                <p className="text-sm text-slate-600">{HELP[selected]}</p>
                {selected === 'new_attempt' && corrections ? (
                  <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
                    <p className="text-sm font-semibold sm:col-span-2">{details.payment.amount} {details.payment.currency || details.payment.currencyCode} · {details.payment.transactionType} · Source {item.sourceBank}</p>
                    {([
                      ['accountName', 'Beneficiary name'], ['accountNumber', 'Beneficiary account'], ['bankName', 'Bank name'],
                      ['swiftCode', 'BIC / SWIFT code'], ['sortCode', 'Sort code'], ['tpin', 'TPIN'],
                      ['purposeCode', 'Purpose code'], ['sectorCode', 'Sector code'], ['plotNo', 'Plot number'],
                      ['streetName', 'Street'], ['town', 'Town'],
                    ] as const).map(([field, label]) => <label key={field} className="text-sm">{label}
                      <input value={corrections[field] || ''} disabled={busy || Boolean(message)} onChange={event => setCorrections(prev => ({ ...prev, [field]: event.target.value }))} maxLength={255} className="mt-1 block w-full rounded-lg border p-2" />
                    </label>)}
                  </div>
                ) : null}
                <label className="block text-sm font-semibold">Reason / bank confirmation reference
                  <textarea value={reason} onChange={event => setReason(event.target.value)} required minLength={10} maxLength={1000} disabled={busy || pending || Boolean(message)} className="mt-1 block w-full rounded-xl border p-3" />
                </label>
                {selected === 'new_attempt' ? <label className="flex items-start gap-2 text-sm text-amber-900">
                  <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required disabled={busy || Boolean(message)} />
                  I reviewed the recorded failure and confirm this corrected new instruction should be submitted. The original instruction remains in the audit history.
                </label> : null}
                <button disabled={busy || pending || Boolean(message) || reason.trim().length < 10 || (selected === 'new_attempt' && !confirmed)} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Recording request...' : LABELS[selected]}</button>
              </form>
            ) : <p className="mt-4 text-sm text-slate-600">No recovery action is available for this outcome or your permissions. Paid payments cannot be resubmitted. Legacy, bulk and conflicting outcomes may require manual bank reconciliation.</p>}
            <h3 className="mt-6 font-semibold">Recovery history</h3>
            <ul className="mt-2 space-y-3 text-sm">
              {details.history.map(entry => <li key={entry.id} className="rounded-xl border p-3">
                <p className="font-semibold">{LABELS[entry.action]} · {entry.status}</p>
                <p>{entry.requestedBy}: {entry.reason}</p>
                {entry.result.message ? <p className="mt-1 text-slate-600">{entry.result.message}</p> : null}
                {entry.result.queueId ? <p className="mt-1 font-mono text-xs">New queue: {entry.result.queueId}</p> : null}
              </li>)}
              {!details.history.length ? <li className="text-slate-500">No recovery actions recorded.</li> : null}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
