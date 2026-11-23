'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Pagination from '@/app/components/Pagination';
import type { BankCode } from '@/app/models/dtos';
import type { BankQueueItem } from '@/app/lib/bankQueue';
import { useAdaptiveQueuePolling } from '@/app/lib/useAdaptiveQueuePolling';
import TransactionHealth from '@/app/components/TransactionHealth';
import PaymentRecoveryDialog from '@/app/components/PaymentRecoveryDialog';
import TransactionDetailsDialog from '@/app/components/TransactionDetailsDialog';
import StatusBadge, { statusLabel } from '@/app/components/StatusBadge';
import { bankResponseReferences } from '@/app/lib/bankResponseDetails';
import { usePortalUser } from '@/app/lib/usePortalUser';
import { PERMISSIONS } from '@/app/lib/permissions';
import { QUEUE_SEARCH_FIELDS, type QueueSearchField } from '@/app/lib/queueSearch';
import { formatAmount } from '@/app/lib/formatAmount';

import { BANK_CODES } from '@/app/lib/enabledBanks';

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? value as Record<string, any> : {};
}

function getQueuePaymentSummary(item: BankQueueItem) {
  const payment = asRecord(item.payment);
  const request = asRecord(payment.request);
  const meta = asRecord(payment.meta);
  const response = asRecord(item.response);
  const responseBody = asRecord(response.response);
  const isBulk = typeof payment.service === 'string' && payment.service.includes('BULK');
  const amount = isBulk ? Number(request.totalAmount ?? 0) : Number(payment.amount ?? 0);

  return {
    isBulk,
    reference: isBulk ? String(request.batchName ?? item.paymentId) : String(payment.transactionId ?? payment.transactionReference ?? item.paymentId),
    description: isBulk ? String(request.description ?? request.narration ?? '') : String(payment.remarks ?? payment.description ?? ''),
    vendor: isBulk ? `${Number(request.totalCount ?? 0)} payments` : [payment.vendorId, payment.accountName].filter(Boolean).join(' · ') || 'N/A',
    amount: Number.isFinite(amount) ? amount : 0,
    currency: isBulk ? String(request.currency ?? '') : String(payment.currency ?? payment.currencyCode ?? ''),
    transactionType: isBulk ? String(meta.transactionType ?? payment.service).replace('ZANACO_BULK_', '') : String(payment.transactionType ?? 'N/A'),
    service: String(payment.service ?? ''),
    batchReference: String(responseBody.batchReference ?? ''),
  };
}

function getQueueResponseDetails(item: BankQueueItem) {
  const response = asRecord(item.response);
  return ['bankStatus', 'bankStatusCode', 'notificationStatus', 'message']
    .map((key) => {
      const value = response[key];
      return value ? { key, value: String(value) } : null;
    })
    .filter((row): row is { key: string; value: string } => row !== null);
}

const ALWAYS_SHOWN_STATUSES = ['queued', 'submitting', 'accepted', 'unknown', 'paid', 'failed', 'rejected', 'needs_review'] as const;
const SHOWN_WHEN_NONZERO = ['pulled', 'processing', 'success'] as const;
const STATUS_CARD_ORDER = ['queued', 'pulled', 'processing', 'submitting', 'accepted', 'unknown', 'paid', 'success', 'failed', 'rejected', 'needs_review'];
const headCell = 'px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-slate-50';

export default function PaymentQueuesPage() {
  const { hasPermission } = usePortalUser();
  const canRecover = hasPermission(PERMISSIONS.BANK_DETAILS_WRITE) || hasPermission(PERMISSIONS.PAYMENTS_POST) || hasPermission(PERMISSIONS.PAYMENTS_RETRY);
  const [recoveryItem, setRecoveryItem] = useState<BankQueueItem | null>(null);
  const [detailItem, setDetailItem] = useState<BankQueueItem | null>(null);
  const [selectedBankTab, setSelectedBankTab] = useState<BankCode | 'ALL'>('ALL');
  const [items, setItems] = useState<BankQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState<number | null>(null);
  const [serverStatusCounts, setServerStatusCounts] = useState<Record<string, number> | null>(null);
  const [searchField, setSearchField] = useState<QueueSearchField>('all');
  const [searchText, setSearchText] = useState('');
  const [appliedSearch, setAppliedSearch] = useState<{ field: QueueSearchField; text: string }>({ field: 'all', text: '' });
  const requestVersion = useRef(0);

  const filteredItems = useMemo(
    () => (selectedBankTab === 'ALL' ? items : items.filter((item) => item.bankCode === selectedBankTab)),
    [items, selectedBankTab],
  );

  const selectBankTab = (tab: BankCode | 'ALL') => {
    setSelectedBankTab(tab);
    setPage(1);
  };

  const loadQueueItems = useCallback(async (): Promise<BankQueueItem[]> => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedBankTab !== 'ALL') params.set('bankCode', selectedBankTab);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (appliedSearch.text) {
        params.set('searchField', appliedSearch.field);
        params.set('search', appliedSearch.text);
      }

      const url = `/api/v1/posted_payments?${params.toString()}`;
      const response = await fetch(url);
      const data = await response.json();
      if (version !== requestVersion.current) return [];

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Could not load queue items');
      }

      const nextItems = Array.isArray(data.items) ? data.items : [];
      setItems(nextItems);
      setTotal(typeof data.total === 'number' ? data.total : null);
      setServerStatusCounts(data.statusCounts && typeof data.statusCounts === 'object' ? data.statusCounts : null);
      return nextItems;
    } catch (err: any) {
      if (version === requestVersion.current) setError(err?.message || 'Unable to load queue items');
      return [];
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [selectedBankTab, page, pageSize, appliedSearch]);

  const { refresh: refreshQueueItems } = useAdaptiveQueuePolling(loadQueueItems, [
    selectedBankTab,
    page,
    pageSize,
    appliedSearch,
  ]);

  // Totals across all matching items come from the API; fall back to the current page if absent.
  const statusCounts = useMemo(() => {
    if (serverStatusCounts) return serverStatusCounts;
    return filteredItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    }, {});
  }, [serverStatusCounts, filteredItems]);

  const visibleStatusCards = STATUS_CARD_ORDER.filter((status) =>
    (ALWAYS_SHOWN_STATUSES as readonly string[]).includes(status)
    || ((SHOWN_WHEN_NONZERO as readonly string[]).includes(status) && (statusCounts[status] ?? 0) > 0));

  return (
    <div className="min-h-screen">
      <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Payment Queue Dashboard</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Bank Queue Processing</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              View queue items for each bank, monitor async processing status, and review errors for failed transactions.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row items-start sm:items-end">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => selectBankTab('ALL')}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${selectedBankTab === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                All Banks
              </button>
              {BANK_CODES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => selectBankTab(code)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${selectedBankTab === code ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  {code}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void refreshQueueItems()}
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Refresh
            </button>
          </div>
        </div>

        <form onSubmit={event => { event.preventDefault(); setPage(1); setAppliedSearch({ field: searchField, text: searchText.trim() }); }} className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-end">
          <label className="text-sm font-semibold text-slate-700">Search by
            <select value={searchField} onChange={event => setSearchField(event.target.value as QueueSearchField)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:w-56">
              {QUEUE_SEARCH_FIELDS.map(field => <option key={field.value} value={field.value}>{field.label}</option>)}
            </select>
          </label>
          <label className="flex-1 text-sm font-semibold text-slate-700">Search payments
            <input type="search" value={searchText} onChange={event => setSearchText(event.target.value)} maxLength={200} placeholder={searchField === 'transactionType' ? 'RTGS, DDACC, INT, SWIFT...' : searchField === 'vendor' ? 'Vendor ID or name...' : searchField === 'reference' ? 'Payment or bank reference...' : 'Enter search value...'} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal" />
          </label>
          <button type="submit" className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Search</button>
          <button type="button" onClick={() => { setSearchField('all'); setSearchText(''); setPage(1); setAppliedSearch({ field: 'all', text: '' }); }} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">Clear</button>
        </form>
        {appliedSearch.text ? <p role="status" className="mt-3 text-sm text-slate-600">{total ?? 0} matching payments for {QUEUE_SEARCH_FIELDS.find(field => field.value === appliedSearch.field)?.label.toLowerCase()}: “{appliedSearch.text}”</p> : null}

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {visibleStatusCards.map((status) => (
            <div key={status} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{statusLabel(status)}</p>
              <p className="mt-3 text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">{(statusCounts[status] ?? 0).toLocaleString('en-GB')}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">Status totals cover all {serverStatusCounts ? 'matching items' : 'items on this page'}{selectedBankTab === 'ALL' ? '' : ` for ${selectedBankTab}`}.</p>
      </div>

      <div data-table-card className="scroll-mt-20 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:scroll-mt-4">
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Queue Transactions</h2>
            <p className="text-sm text-slate-500">Showing {selectedBankTab === 'ALL' ? 'all banks' : selectedBankTab} queue items.</p>
          </div>
          <div className="text-sm text-slate-500">
            {loading ? 'Refreshing...' : `${(total ?? filteredItems.length).toLocaleString('en-GB')} items`}
          </div>
        </div>

        <div data-table-scroll className="max-h-[70vh] overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_0_rgb(226_232_240)]">
              <tr>
                <th className={headCell}>Bank</th>
                <th className={`${headCell} min-w-[200px]`}>Reference / Description</th>
                <th className={`${headCell} min-w-[180px]`}>Bank Reference</th>
                <th className={`${headCell} min-w-[220px]`}>Vendor</th>
                <th className={`${headCell} text-right`}>Amount</th>
                <th className={headCell}>Txn Type</th>
                <th className={`${headCell} min-w-[160px]`}>Status</th>
                <th className={headCell}>Attempts</th>
                <th className={`${headCell} min-w-[170px]`}>Payment processed (UTC+2)</th>
                <th className={`${headCell} min-w-[220px]`}>Error</th>
                <th className={headCell}>Recovery</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {error ? (
                <tr>
                  <td colSpan={11} className="px-5 py-12 text-center text-sm text-rose-700">
                    {error}
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-5 py-12 text-center text-sm text-slate-500">
                    {loading ? 'Loading queue items...' : appliedSearch.text ? 'No payments match this search.' : 'No queue transactions found.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const summary = getQueuePaymentSummary(item);
                  const responseDetails = getQueueResponseDetails(item);
                  const bankRefs = bankResponseReferences(item.response).filter(ref => ref.label.startsWith('Bank'));
                  return (
                  <tr key={item.id} onClick={() => setDetailItem(item)} className="cursor-pointer align-top hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                      {item.bankCode}
                      {summary.isBulk ? <div className="mt-1 text-xs font-normal text-slate-500">Bulk batch</div> : null}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      <button type="button" onClick={() => setDetailItem(item)} className="break-all text-left font-mono font-semibold text-slate-800 underline decoration-slate-300 underline-offset-4">{summary.reference}</button>

                      {summary.description ? (
                        <div className="mt-1 max-w-[260px] whitespace-normal text-xs text-slate-500 line-clamp-2" title={summary.description}>
                          {summary.description}
                        </div>
                      ) : null}
                      {summary.batchReference ? <div className="mt-1 text-xs text-slate-500">Batch: {summary.batchReference}</div> : null}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      {bankRefs.length
                        ? bankRefs.map(ref => (
                          <div key={`${ref.label}:${ref.value}`} className="mb-2"><div className="text-xs text-slate-500">{ref.label}</div><span className="select-all break-all font-mono font-semibold">{ref.value}</span></div>
                        )) : <span className="text-xs text-slate-500">Not received</span>}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">{summary.vendor}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-right text-sm font-semibold tabular-nums text-slate-800">{formatAmount(summary.amount, summary.currency)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-700">
                      {summary.transactionType}
                      {summary.service ? <div className="mt-1 text-xs text-slate-500">{summary.service}</div> : null}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      <StatusBadge status={item.status} />
                      {responseDetails.length ? (
                        <div className="mt-1 text-xs font-normal break-words">
                          {responseDetails.map((detail) => (
                            <div key={detail.key}>{detail.key}: {detail.value}</div>
                          ))}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 text-sm tabular-nums text-slate-700">{item.attempts}</td>
                    <td className="px-5 py-4 text-sm text-slate-700">{item.processedAt ? new Date(item.processedAt).toLocaleString('en-GB', { timeZone: 'Africa/Johannesburg', dateStyle: 'medium', timeStyle: 'medium' }) : ['success', 'paid', 'failed', 'rejected', 'partially_completed'].includes(item.status) ? 'Not recorded' : 'Awaiting final status'}</td>
                    <td className="max-w-[320px] px-5 py-4 text-sm">
                      <div className="line-clamp-3 break-words" title={item.lastError ?? undefined}><TransactionHealth status={item.status} error={item.lastError} /></div>
                    </td>
                    <td className="px-5 py-4 text-sm" onClick={event => event.stopPropagation()}>
                      <div className="flex gap-2 whitespace-nowrap">
                        <button type="button" onClick={() => setDetailItem(item)} className="rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100">View details</button>
                        {['IZB', 'ZANACO', 'ZICB'].includes(item.bankCode) ? <button type="button" onClick={() => setRecoveryItem(item)} className="rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100">{!canRecover ? 'View history' : ['failed', 'rejected'].includes(item.status) ? 'Correct details / recovery' : 'Recovery / history'}</button> : null}
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          itemLabel="payments"
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>
      {recoveryItem ? <PaymentRecoveryDialog key={recoveryItem.id} item={recoveryItem}
        canEdit={hasPermission(PERMISSIONS.BANK_DETAILS_WRITE)} canRecover={hasPermission(PERMISSIONS.PAYMENTS_POST)} canRetry={hasPermission(PERMISSIONS.PAYMENTS_RETRY)}
        onClose={() => setRecoveryItem(null)} onChange={() => void refreshQueueItems()} /> : null}
      {detailItem ? <TransactionDetailsDialog key={detailItem.id} item={detailItem} onClose={() => setDetailItem(null)} /> : null}
    </div>
  );
}
