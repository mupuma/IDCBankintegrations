'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import TransactionHealth from '@/app/components/TransactionHealth';
import type { BankQueueItem } from '@/app/lib/bankQueue';
import { bankResponseReferences } from '@/app/lib/bankResponseDetails';

const record = (value: unknown): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
const labelFor = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
function dateLabel(value: unknown) {
  const raw = String(value ?? ''), date = new Date(raw);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Johannesburg', dateStyle: 'medium',
    ...(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? {} : { timeStyle: 'medium' as const }),
  }).format(date) : 'Not supplied';
}
function Value({ children }: { children: ReactNode }) {
  return children === null || children === undefined || children === ''
    ? <span className="font-normal text-slate-500">Not supplied</span> : <>{children}</>;
}
function Detail({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return <div className="min-w-0"><dt className="text-xs font-medium text-slate-500">{label}</dt>
    <dd className={`mt-1 break-words text-sm font-semibold leading-6 text-slate-900 ${mono ? 'select-all font-mono [overflow-wrap:anywhere]' : ''}`}><Value>{value}</Value></dd></div>;
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h3 className="mb-4 text-sm font-bold text-slate-900">{title}</h3>{children}</section>;
}
function SavedFields({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined || value === '') return <span className="text-slate-500">Not supplied</span>;
  if (typeof value !== 'object') return <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{String(value)}</span>;
  const entries = Object.entries(value);
  if (!entries.length) return <span className="text-slate-500">No saved fields</span>;
  return <dl className="divide-y divide-slate-200">{entries.map(([key, child]) => {
    const nested = child !== null && typeof child === 'object';
    return <div key={key} className="grid min-w-0 gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(110px,1fr)_minmax(0,2fr)] sm:gap-4">
      <dt className="break-words text-xs font-semibold capitalize leading-6 text-slate-600">{Array.isArray(value) ? `Item ${Number(key) + 1}` : labelFor(key)}</dt>
      <dd className="min-w-0 text-sm leading-6 text-slate-800">{nested ? <details open={depth < 1} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-blue-700">{Array.isArray(child) ? `${child.length} items` : 'View fields'}</summary>
        <div className="mt-3"><SavedFields value={child} depth={depth + 1} /></div>
      </details> : <SavedFields value={child} depth={depth + 1} />}</dd>
    </div>;
  })}</dl>;
}

export default function TransactionDetailsDialog({ item, onClose }: { item: BankQueueItem; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null), headingId = useId(), tabId = useId();
  const [view, setView] = useState<'overview' | 'saved'>('overview');
  useEffect(() => {
    const element = dialog.current;
    if (!element?.open) element?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; if (element?.open) element.close(); };
  }, []);

  const payment = record(item.payment), request = record(payment.request), response = record(item.response);
  const original = record(payment.originalPayment), address = record(payment.physicalAddress || original.physicalAddress);
  const bulk = Array.isArray(request.items);
  const amountValue = payment.amount ?? request.totalAmount ?? request.amount;
  const amount = amountValue !== null && amountValue !== undefined && amountValue !== '' && Number.isFinite(Number(amountValue))
    ? Number(amountValue).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : 'Not supplied';
  const currency = String(payment.currency || payment.currencyCode || payment.ccy || request.currency || request.ccy || '');
  const references = bankResponseReferences(item.response), bankReferences = references.filter(ref => ref.label.startsWith('Bank'));
  const healthy = ['success', 'paid'].includes(item.status) && !item.lastError;
  const attention = ['failed', 'rejected', 'needs_review', 'unknown', 'partially_completed'].includes(item.status) || Boolean(item.lastError);
  const statusStyle = healthy ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : attention ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-blue-200 bg-blue-50 text-blue-800';

  return <dialog ref={dialog} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    aria-labelledby={headingId} className="m-auto max-h-[92dvh] w-[min(1040px,96vw)] max-w-none overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 p-0 text-slate-900 shadow-2xl outline-none backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm [color-scheme:light]">
    <div className="flex max-h-[92dvh] flex-col">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:px-8">
        <div className="flex min-w-0 items-start gap-3">
          <div className="hidden rounded-xl bg-blue-50 p-3 text-blue-700 sm:block" aria-hidden="true"><svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 7h6M9 11h6M9 15h3" /></svg></div>
          <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-700">Transaction record</p>
            <h2 id={headingId} className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Payment details</h2>
            <p className="mt-1 break-all font-mono text-xs text-slate-500">{item.paymentId}</p></div>
        </div>
        <button autoFocus type="button" onClick={onClose} aria-label="Close transaction details" className="shrink-0 rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
          <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0"><p className="text-xs font-semibold text-slate-500">{bulk ? 'Batch amount' : 'Payment amount'}</p>
              <p className="mt-2 break-words text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{amount} <span className="text-lg font-semibold text-slate-500">{currency}</span></p>
              <p className="mt-2 text-sm text-slate-600">{item.bankCode}<span className="mx-2 text-slate-300">/</span>{String(payment.transactionType || record(payment.meta).transactionType || payment.service || 'Bank payment')}</p>
            </div>
            <div className="sm:text-right"><span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${statusStyle}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{item.status.replace(/_/g, ' ')}</span>
              <div className="mt-2 max-w-sm text-sm leading-6"><TransactionHealth status={item.status} error={item.lastError} /></div></div>
          </div>
          <div className="mt-5 border-t border-slate-100 pt-4"><p className="text-xs font-semibold text-slate-500">Bank reconciliation reference</p>
            {bankReferences.length ? <div className="mt-2 flex flex-wrap gap-2">{bankReferences.map(ref => <span key={`${ref.label}:${ref.value}`} className="inline-flex max-w-full flex-col rounded-lg border border-blue-100 bg-blue-50 px-3 py-2"><span className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">{ref.label}</span><span className="mt-1 select-all break-all font-mono text-sm font-semibold text-blue-950">{ref.value}</span></span>)}</div>
              : <p className="mt-2 text-sm text-slate-600">No bank reference has been received.</p>}
          </div>
        </section>

        <div role="tablist" aria-label="Transaction information" className="my-5 flex gap-1 rounded-xl border border-slate-200 bg-slate-200/60 p-1">
          {(['overview', 'saved'] as const).map(tab => <button key={tab} id={`${tabId}-${tab}`} role="tab" type="button" aria-selected={view === tab} aria-controls={`${tabId}-panel`} tabIndex={view === tab ? 0 : -1}
            onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 'overview' : event.key === 'End' ? 'saved' : tab === 'overview' ? 'saved' : 'overview'; setView(next); document.getElementById(`${tabId}-${next}`)?.focus(); } }}
            onClick={() => setView(tab)} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-blue-600 ${view === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'}`}>{tab === 'overview' ? 'Overview' : 'All saved details'}</button>)}
        </div>

        <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${view}`}>
          {view === 'overview' ? <div className="grid gap-4 md:grid-cols-2">
            <Section title={bulk ? 'Batch information' : 'Beneficiary'}><dl className="grid gap-4 sm:grid-cols-2">
              <Detail label={bulk ? 'Batch name' : 'Account name'} value={payment.accountName || payment.name || payment.beneName || request.name || request.batchName} />
              <Detail label="Vendor ID" value={payment.vendorId || original.vendorId || request.vendorId} mono />
              <Detail label="Beneficiary account" value={payment.accountNumber || payment.creditAccount || request.creditAccount} mono />
              <Detail label="Beneficiary bank" value={payment.bankName || request.bankName} />
              <Detail label="Branch / sort code" value={[payment.branchCode, payment.sortCode || request.sortCode].filter(Boolean).join(' / ')} mono />
              <Detail label="SWIFT / BIC" value={payment.swiftCode || payment.bicCode || request.bicCode} mono />
            </dl></Section>
            <Section title="Payment instruction"><dl className="grid gap-4 sm:grid-cols-2">
              <Detail label="Source account code" value={item.sourceBank} mono />
              <Detail label="Debit account" value={payment.srcAcc || payment.debitAccount || request.debitAccount} mono />
              <Detail label="Source account name" value={payment.srcName || request.srcName} />
              <Detail label="Payment / value date" value={dateLabel(payment.transactionDate || payment.valueDate || request.valueDate)} />
              <Detail label="Sage bank code" value={payment.sageBankCode || original.sageBankCode} mono />
              <Detail label="Payment reference" value={payment.transactionId || payment.transactionReference || payment.externalTranRef || request.externalTranRef} mono />
            </dl></Section>
            <div className="md:col-span-2"><Section title="Description / narration"><p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700"><Value>{payment.remarks || payment.description || payment.paymentDetails || request.description || request.paymentDetails || request.narration}</Value></p></Section></div>
            <Section title="Processing history"><dl className="grid gap-4 sm:grid-cols-2">
              <Detail label="Queued" value={dateLabel(item.createdAt)} />
              <Detail label="Payment processed (fixed)" value={item.processedAt ? dateLabel(item.processedAt) : 'Not recorded'} />
              <Detail label="Last updated" value={dateLabel(item.updatedAt)} />
              <Detail label="Processing attempts" value={item.attempts} />
              <Detail label="Bank status" value={String(response.bankStatus || response.rawStatus || response.bankStatusCode || '')} />
              <div className="sm:col-span-2"><Detail label="Queue reference" value={item.id} mono /></div>
              {payment.recoveryOf ? <div className="sm:col-span-2"><Detail label="Previous attempt" value={String(payment.recoveryOf)} mono /></div> : null}
            </dl></Section>
            <Section title="Contact and address"><dl className="grid gap-4 sm:grid-cols-2">
              <Detail label="Email" value={payment.email || original.email} />
              <Detail label="Phone number" value={payment.phoneNumber || original.phoneNumber} />
              <div className="sm:col-span-2"><Detail label="Address" value={[address.plotNo, address.streetName, address.town, payment.countryOfOrigin || original.countryOfOrigin].filter(Boolean).join(', ')} /></div>
              <Detail label="TPIN" value={payment.tpin || payment.tpIn || original.tpin} mono />
            </dl></Section>
          </div> : <div className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">The complete saved records for this instruction, including any batch items and bank callback fields.</p>
            <Section title="Saved payment"><SavedFields value={item.payment} /></Section>
            <Section title="Saved bank response"><SavedFields value={item.response} /></Section>
            <Section title="Queue metadata"><SavedFields value={{ queueId: item.id, paymentId: item.paymentId, bankCode: item.bankCode, sourceBank: item.sourceBank, status: item.status, attempts: item.attempts, lastError: item.lastError, createdAt: item.createdAt, processedAt: item.processedAt, updatedAt: item.updatedAt }} /></Section>
          </div>}
        </div>
      </div>

      <footer className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="text-xs text-slate-500">All times shown in Africa/Johannesburg (UTC+2).</p>
        <button type="button" onClick={onClose} className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">Done</button>
      </footer>
    </div>
  </dialog>;
}
