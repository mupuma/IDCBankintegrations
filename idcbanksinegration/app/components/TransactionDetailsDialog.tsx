'use client';

import TransactionHealth from '@/app/components/TransactionHealth';
import { useEffect, useRef } from 'react';
import type { BankQueueItem } from '@/app/lib/bankQueue';
import { bankResponseReferences } from '@/app/lib/bankResponseDetails';

function Fields({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-slate-400">Not supplied</span>;
  if (typeof value !== 'object') return <span className="whitespace-pre-wrap break-all">{String(value)}</span>;
  return <dl className="space-y-3">{Object.entries(value).map(([key, child]) => (
    <div key={key} className="border-l border-slate-200 pl-3">
      <dt className="text-xs font-semibold text-slate-500">{key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ')}</dt>
      <dd className="mt-1 text-sm text-slate-800"><Fields value={child} /></dd>
    </div>
  ))}</dl>;
}

export default function TransactionDetailsDialog({ item, onClose }: { item: BankQueueItem; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const references = bankResponseReferences(item.response);
  return <dialog ref={dialog} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    aria-labelledby="transaction-details-title" className="m-auto max-h-[90vh] w-[min(900px,95vw)] rounded-2xl bg-white p-6 shadow-xl backdrop:bg-slate-900/50">
    <div className="flex items-start justify-between gap-4">
      <div><h2 id="transaction-details-title" className="text-xl font-bold">Transaction details</h2>
        <p className="mt-1 break-all font-mono text-sm">{item.paymentId}</p></div>
      <button autoFocus type="button" onClick={onClose} className="rounded-lg border px-4 py-2">Close</button>
    </div>
    <div className="my-5 rounded-xl bg-slate-50 p-4">
      <p className="font-semibold">{item.bankCode} · {item.status}</p>
      <p className="mt-2 text-sm">Error: <TransactionHealth status={item.status} error={item.lastError} /></p>
      {references.length ? references.map(ref => <p key={`${ref.label}:${ref.value}`} className="mt-2 break-all text-sm"><strong>{ref.label}:</strong> <span className="font-mono">{ref.value}</span></p>) : <p className="mt-2 text-sm text-slate-500">No bank reference received yet.</p>}
    </div>
    <div className="grid gap-6 md:grid-cols-2">
      <section><h3 className="mb-3 font-bold">Payment details</h3><Fields value={item.payment} /></section>
      <section><h3 className="mb-3 font-bold">Bank response</h3><Fields value={item.response} /></section>
    </div>
    <section className="mt-6"><h3 className="mb-3 font-bold">Processing details</h3>
      <Fields value={{ queueId: item.id, sourceBank: item.sourceBank, status: item.status, attempts: item.attempts,
        lastError: item.lastError, createdAt: item.createdAt, updatedAt: item.updatedAt }} /></section>
  </dialog>;
}
