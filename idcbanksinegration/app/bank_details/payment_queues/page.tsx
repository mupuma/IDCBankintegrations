'use client';

import { useCallback, useMemo, useState } from 'react';
import Pagination from '@/app/components/Pagination';
import type { BankCode } from '@/app/models/dtos';
import type { BankQueueItem } from '@/app/lib/bankQueue';
import { useAdaptiveQueuePolling } from '@/app/lib/useAdaptiveQueuePolling';

const BANK_CODES: BankCode[] = ['ZICB'];

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
    reference: isBulk ? String(request.batchName ?? item.paymentId) : String(payment.transactionReference ?? item.paymentId),
    vendor: isBulk ? `${Number(request.totalCount ?? 0)} payments` : String(payment.vendorId ?? payment.accountName ?? 'N/A'),
    amount: Number.isFinite(amount) ? amount : 0,
    currency: isBulk ? String(request.currency ?? '') : String(payment.currency ?? payment.currencyCode ?? ''),
    transactionType: isBulk ? String(meta.transactionType ?? payment.service).replace('ZANACO_BULK_', '') : String(payment.transactionType ?? 'N/A'),
    service: String(payment.service ?? ''),
    batchReference: String(responseBody.batchReference ?? ''),
  };
}

export default function PaymentQueuesPage() {
  const [selectedBankTab, setSelectedBankTab] = useState<BankCode | 'ALL'>('ALL');
  const [items, setItems] = useState<BankQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState<number | null>(null);

  const filteredItems = useMemo(
    () => (selectedBankTab === 'ALL' ? items : items.filter((item) => item.bankCode === selectedBankTab)),
    [items, selectedBankTab],
  );

  const selectBankTab = (tab: BankCode | 'ALL') => {
    setSelectedBankTab(tab);
    setPage(1);
  };

  const loadQueueItems = useCallback(async (): Promise<BankQueueItem[]> => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedBankTab !== 'ALL') params.set('bankCode', selectedBankTab);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));

      const url = `/api/v1/posted_payments?${params.toString()}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Could not load queue items');
      }

      const nextItems = Array.isArray(data.items) ? data.items : [];
      setItems(nextItems);
      setTotal(typeof data.total === 'number' ? data.total : null);
      return nextItems;
    } catch (err: any) {
      setError(err?.message || 'Unable to load queue items');
      return [];
    } finally {
      setLoading(false);
    }
  }, [selectedBankTab, page, pageSize]);

  const { refresh: refreshQueueItems } = useAdaptiveQueuePolling(loadQueueItems, [
    selectedBankTab,
    page,
    pageSize,
  ]);

  const statusCounts = useMemo(() => {
    return filteredItems.reduce(
      (acc, item) => {
        acc[item.status] = (acc[item.status] ?? 0) + 1;
        return acc;
      },
      {
        queued: 0,
        processing: 0,
        success: 0,
        failed: 0,
      } as Record<string, number>,
    );
  }, [filteredItems]);

  return (
    <div className="min-h-screen">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm mb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Payment Queue Dashboard</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Bank Queue Processing</h1>
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

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {(['queued', 'processing', 'submitting', 'accepted', 'unknown', 'paid', 'success', 'failed', 'rejected', 'needs_review'] as const).map((status) => (
            <div key={status} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">{status}</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">{statusCounts[status] ?? 0}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Queue Transactions</h2>
            <p className="text-sm text-slate-500">Showing {selectedBankTab === 'ALL' ? 'all banks' : selectedBankTab} queue items.</p>
          </div>
          <div className="text-sm text-slate-500">
            {loading ? 'Refreshing...' : `${filteredItems.length} items`}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/60">
                <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Bank</th>
                <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Reference</th>
                <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Vendor</th>
                <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Amount</th>
                <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Txn Type</th>
                <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Attempts</th>
                <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Updated</th>
                <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {error ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-sm text-rose-700">
                    {error}
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-sm text-slate-500">
                    {loading ? 'Loading queue items...' : 'No queue transactions found.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                      {item.bankCode}
                      {getQueuePaymentSummary(item).isBulk ? <div className="mt-1 text-xs font-normal text-slate-500">Bulk batch</div> : null}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      {getQueuePaymentSummary(item).reference}
                      {getQueuePaymentSummary(item).batchReference ? <div className="mt-1 text-xs text-slate-500">Batch: {getQueuePaymentSummary(item).batchReference}</div> : null}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">{getQueuePaymentSummary(item).vendor}</td>
                    <td className="px-5 py-4 text-sm text-slate-700">{getQueuePaymentSummary(item).amount.toFixed(2)} {getQueuePaymentSummary(item).currency}</td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      {getQueuePaymentSummary(item).transactionType}
                      {getQueuePaymentSummary(item).service ? <div className="mt-1 text-xs text-slate-500">{getQueuePaymentSummary(item).service}</div> : null}
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-700">{item.status}{item.bankCode === 'ZICB' && item.response && typeof item.response === 'object' ? <div className="mt-1 text-xs font-normal">{['reference', 'prcn_number', 'bankRef', 'accountingStatus', 'accountingError'].map(key => { const value = (item.response as Record<string, unknown>)[key]; return value ? <div key={key}>{key}: {String(value)}</div> : null; })}</div> : null}</td>
                    <td className="px-5 py-4 text-sm text-slate-700">{item.attempts}</td>
                    <td className="px-5 py-4 text-sm text-slate-700">{new Date(item.updatedAt).toLocaleString()}</td>
                    <td className="px-5 py-4 text-sm text-rose-700">{item.lastError || 'N/A'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>
    </div>
  );
}
