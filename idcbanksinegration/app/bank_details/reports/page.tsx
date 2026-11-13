'use client';

import { useEffect, useRef, useState } from 'react';
import TransactionHealth from '@/app/components/TransactionHealth';
import Pagination from '@/app/components/Pagination';
import TransactionDetailsDialog from '@/app/components/TransactionDetailsDialog';
import { usePortalUser } from '@/app/lib/usePortalUser';
import { PERMISSIONS } from '@/app/lib/permissions';
import { REPORT_STATUSES, type ReportRow } from '@/app/lib/transactionReports';
import type { BankQueueItem } from '@/app/lib/bankQueue';

type Summary = { period: string; bank: string; currency: string; status: string; count: number; amount: string; missingAmounts: number };
type Report = { items: ReportRow[]; groups: Summary[]; total: number; missingReferences: number; dataQualityWarnings: number; historicalDates: number; generatedAt: string };
const initial = { groupBy: 'day', dateBasis: 'processed', from: '', to: '', bank: '', status: 'completed', sourceBank: '', currency: '', transactionType: '', vendor: '', account: '', reference: '', search: '', minAmount: '', maxAmount: '', missingReference: '' };
const inputClass = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal';
const cellClass = 'whitespace-nowrap border-b border-slate-100 px-4 py-3 text-left text-sm';

export default function TransactionReportsPage() {
  const { loading: userLoading, hasPermission } = usePortalUser();
  const allowed = hasPermission(PERMISSIONS.REPORTS_READ);
  const [draft, setDraft] = useState(initial), [applied, setApplied] = useState(initial);
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(25), [version, setVersion] = useState(0);
  const [data, setData] = useState<Report | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false), [detail, setDetail] = useState<BankQueueItem | null>(null);
  const downloadController = useRef<AbortController | null>(null);
  useEffect(() => () => downloadController.current?.abort(), []);
  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    setLoading(true); setError(''); setData(null);
    const params = new URLSearchParams({ ...applied, page: String(page), pageSize: String(pageSize) });
    fetch(`/api/v1/transaction_reports?${params}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to load reports'); return body; })
      .then(body => { if (!controller.signal.aborted) setData(body); })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [allowed, applied, page, pageSize, version]);

  const change = (key: keyof typeof initial, value: string) => setDraft(previous => ({ ...previous, [key]: value }));
  async function download(format: 'csv' | 'summary_csv') {
    setDownloading(true); setError('');
    const controller = new AbortController(); downloadController.current = controller;
    try {
      const response = await fetch(`/api/v1/transaction_reports?${new URLSearchParams({ ...applied, format })}`, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error || 'Export failed'); }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = `${format === 'csv' ? 'transaction-reconciliation' : 'reconciliation-summary'}-${applied.from || 'all'}-${applied.to || 'dates'}.csv`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Export failed; no complete report was downloaded'); }
    finally { setDownloading(false); }
  }
  function showDetails(row: ReportRow) {
    setDetail({ id: row.queueId, paymentId: row.paymentId, bankCode: row.bank as BankQueueItem['bankCode'], sourceBank: row.sourceBank,
      payment: row.payment as BankQueueItem['payment'], response: row.response, status: row.status as BankQueueItem['status'],
      attempts: row.attempts, lastError: row.error, createdAt: row.createdAt, updatedAt: row.processedAt });
  }
  if (userLoading) return <p className="p-8">Loading permissions…</p>;
  if (!allowed) return <p role="alert" className="p-8">Transaction reports are available to Payment Operators and Administrators.</p>;

  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold text-slate-900">Transaction reconciliation reports</h1>
      <p className="mt-2 text-sm text-slate-600">Review bank outcomes by day, month or year. All dates use Africa/Johannesburg (UTC+2). Totals are separated by bank, currency and status.</p>
      <p className="mt-2 text-sm text-slate-600">Completed payments are shown by default. Select all statuses to include pending, failed, uncertain and never-sent instructions. Dates reflect when the portal recorded the bank outcome; historical records may use their last update. All dates includes undated records.</p>
    </div>
    <form onSubmit={event => { event.preventDefault(); setPage(1); setApplied({ ...draft }); }} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-semibold">Group by<select className={inputClass} value={draft.groupBy} onChange={e => change('groupBy', e.target.value)}><option value="day">Day</option><option value="month">Month</option><option value="year">Year</option></select></label>
        <label className="text-sm font-semibold">Date basis<select className={inputClass} value={draft.dateBasis} onChange={e => change('dateBasis', e.target.value)}><option value="processed">Outcome recorded</option><option value="created">Queued date</option><option value="payment">Payment / value date</option></select></label>
        <label className="text-sm font-semibold">From (inclusive)<input className={inputClass} type="date" value={draft.from} onChange={e => change('from', e.target.value)} /></label>
        <label className="text-sm font-semibold">To (inclusive)<input className={inputClass} type="date" value={draft.to} onChange={e => change('to', e.target.value)} /></label>
        <label className="text-sm font-semibold">Bank<select className={inputClass} value={draft.bank} onChange={e => change('bank', e.target.value)}><option value="">All banks</option>{['IZB', 'ZICB', 'ZANACO'].map(bank => <option key={bank}>{bank}</option>)}</select></label>
        <label className="text-sm font-semibold">Status<select className={inputClass} value={draft.status} onChange={e => change('status', e.target.value)}><option value="completed">Completed (paid / success)</option><option value="final">Final outcomes (includes failures)</option><option value="all">All statuses</option>{REPORT_STATUSES.map(status => <option key={status}>{status}</option>)}</select></label>
        <label className="text-sm font-semibold">Search all saved details<input className={inputClass} type="search" maxLength={250} value={draft.search} onChange={e => change('search', e.target.value)} placeholder="Narration, error, payment detail…" /></label>
        <label className="text-sm font-semibold">Bank reference availability<select className={inputClass} value={draft.missingReference} onChange={e => change('missingReference', e.target.value)}><option value="">All transactions</option><option value="yes">Missing bank reference</option><option value="no">Has bank reference</option></select></label>
      </div>
      <details className="mt-5"><summary className="cursor-pointer text-sm font-semibold">Detailed reconciliation filters</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {([['sourceBank', 'Source account code'], ['currency', 'Currency (e.g. ZMW)'], ['transactionType', 'Transaction type (e.g. RTGS)'], ['vendor', 'Vendor ID / beneficiary name'], ['account', 'Beneficiary / debit account'], ['reference', 'Payment / bank reference'], ['minAmount', 'Minimum amount'], ['maxAmount', 'Maximum amount']] as const).map(([key, label]) => (
            <label key={key} className="text-sm font-semibold">{label}<input className={inputClass} maxLength={250} inputMode={key.includes('Amount') ? 'decimal' : 'text'} value={draft[key]} onChange={e => change(key, e.target.value)} /></label>
          ))}
        </div>
      </details>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="submit" disabled={loading || downloading} className="rounded-xl bg-slate-900 px-5 py-2.5 font-semibold text-white disabled:opacity-50">Apply filters</button>
        <button type="button" onClick={() => { setDraft(initial); setApplied(initial); setPage(1); setVersion(v => v + 1); }} className="rounded-xl border px-4 py-2">Reset filters</button>
        <button type="button" disabled={loading || downloading} onClick={() => setVersion(v => v + 1)} className="rounded-xl border px-4 py-2">Refresh</button>
        <button type="button" disabled={!data || loading || downloading} onClick={() => void download('csv')} className="rounded-xl border border-blue-300 px-4 py-2 font-semibold text-blue-800 disabled:opacity-50">{downloading ? 'Exporting…' : 'Export all matching transactions (CSV)'}</button>
        <button type="button" disabled={!data || loading || downloading} onClick={() => void download('summary_csv')} className="rounded-xl border px-4 py-2 disabled:opacity-50">Export period totals</button>
      </div>
      <p className="mt-3 text-xs text-slate-500">Exports use the applied filters and include all matching pages. Transaction CSV includes full saved payment and response details. Bulk rows retain their batch status; individual settlement is not inferred.</p>
    </form>
    {error ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-800">{error}</p> : null}
    {loading ? <p role="status">Scanning saved transactions…</p> : null}
    {data ? <>
      <div className="grid gap-3 sm:grid-cols-4">{[['Matching transactions / bulk items', data.total], ['Missing bank references', data.missingReferences], ['Historical date fallbacks', data.historicalDates], ['Rows with reconciliation notes', data.dataQualityWarnings]].map(([label, count]) => <div key={label} className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{count}</p></div>)}</div>
      <section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-bold">Period totals</h2><div className="mt-3 max-h-96 overflow-auto"><table className="w-full"><thead><tr>{['Period', 'Bank', 'Currency', 'Status', 'Count', 'Amount', 'Missing amounts'].map(label => <th key={label} className={cellClass}>{label}</th>)}</tr></thead><tbody>{data.groups.map(group => <tr key={`${group.period}:${group.bank}:${group.currency}:${group.status}`}>{[group.period, group.bank, group.currency, group.status, group.count, group.amount, group.missingAmounts].map((value, i) => <td key={i} className={cellClass}>{value}</td>)}</tr>)}</tbody></table></div></section>
      <section className="overflow-hidden rounded-2xl border bg-white"><h2 className="p-5 text-lg font-bold">Transactions</h2><div className="overflow-x-auto"><table className="w-full"><thead><tr>{['Date / source', 'Bank / source account', 'Payment', 'Vendor / beneficiary', 'Account', 'Amount', 'Type', 'Status', 'Bank references', 'Notes / error'].map(label => <th key={label} className={cellClass}>{label}</th>)}</tr></thead><tbody>
        {data.items.map(row => <tr key={row.rowId} className="cursor-pointer hover:bg-slate-50" onClick={() => showDetails(row)}>
          <td className={cellClass}>{row.reportDate || 'Undated'}<div className="text-xs text-slate-500">{row.dateSource}</div></td>
          <td className={cellClass}>{row.bank}<div className="text-xs">{row.sourceBank}</div></td>
          <td className={cellClass}><button type="button" className="font-mono underline" onClick={() => showDetails(row)}>{row.paymentId}</button></td>
          <td className={cellClass}>{row.vendorId}<div>{row.beneficiary}</div></td><td className={`${cellClass} font-mono`}>{row.account}</td>
          <td className={cellClass}>{row.amount || 'Missing'} {row.currency}</td><td className={cellClass}>{row.transactionType}</td>
          <td className={cellClass}>{row.status}<div className="text-xs text-slate-500">{row.statusScope}</div></td><td className={`${cellClass} select-all font-mono`}>{row.bankReferences || 'Not received'}</td>
          <td className={`${cellClass} max-w-sm !whitespace-normal text-xs`}>{row.dataQuality}<div className="mt-1"><TransactionHealth status={row.status} error={row.error} /></div></td>
        </tr>)}
        {!data.total ? <tr><td colSpan={10} className="p-8 text-center text-slate-500">No transactions match these filters. Try all dates or all statuses.</td></tr> : null}
      </tbody></table></div><Pagination page={page} pageSize={pageSize} total={data.total} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} /></section>
      <p className="text-xs text-slate-500">Generated {new Date(data.generatedAt).toLocaleString('en-GB', { timeZone: 'Africa/Johannesburg' })} (UTC+2). Counts include saved attempts and individual bulk items. Missing amounts remain visible and are excluded from monetary totals.</p>
    </> : null}
    {detail ? <TransactionDetailsDialog item={detail} onClose={() => setDetail(null)} /> : null}
  </div>;
}
