'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ApprovalSnapshot } from '@/app/lib/paymentApprovals';

interface ApprovalItem {
  queueId: string;
  paymentId: string;
  bankCode: string;
  sourceBank?: string;
  status: string;
  payment: Record<string, unknown>;
  approval: ApprovalSnapshot | null;
  canDecide: boolean;
}

const button = 'rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50';

function ApprovalCard({ item, onDecide, busy }: {
  item: ApprovalItem;
  onDecide: (item: ApprovalItem, action: 'approve' | 'reject', reason: string) => Promise<void>;
  busy: boolean;
}) {
  const [reason, setReason] = useState('');
  const active = item.approval?.workflow.stages[item.approval.stage];
  const decisions = item.approval?.decisions ?? [];
  const count = decisions.filter(decision => decision.stage === item.approval?.stage && decision.action === 'approve').length;
  const instruction = item.payment;
  const bulk = instruction.request as { totalAmount?: number; currency?: string; totalCount?: number } | undefined;
  const amount = instruction.amount ?? bulk?.totalAmount;
  const currency = instruction.currency ?? instruction.currencyCode ?? bulk?.currency;
  return <article className="space-y-3 rounded-xl border bg-white p-4">
    <h2 className="font-semibold">{item.paymentId} · {item.bankCode}{item.sourceBank ? ' · ' + item.sourceBank : ''}</h2>
    <p className="text-sm">{String(instruction.vendorName ?? instruction.accountName ?? (bulk?.totalCount ? bulk.totalCount + ' payments' : ''))}
      {amount != null && <> · {String(amount)} {String(currency ?? '')}</>}</p>
    <p className="text-sm">{item.approval?.workflow.name} · {item.status === 'awaiting_approval' && active
      ? 'Stage ' + (item.approval!.stage + 1) + ' of ' + item.approval!.workflow.stages.length + ' · ' + active.name + ' · ' + count + '/' + active.required + ' approved'
      : item.status.replaceAll('_', ' ')}</p>
    <details className="text-sm">
      <summary className="cursor-pointer font-medium">Payment instruction</summary>
      <pre className="mt-2 max-h-80 overflow-auto rounded bg-slate-50 p-3">{JSON.stringify(instruction, null, 2)}</pre>
    </details>
    {!!decisions.length && <ul className="space-y-1 text-sm">
      {decisions.map((decision, i) => <li key={i}>
        Stage {decision.stage + 1} · {decision.username} · {decision.action === 'approve' ? 'Approved' : 'Rejected'} · {new Date(decision.at).toLocaleString()}
        {decision.reason ? ' · ' + decision.reason : ''}
      </li>)}
    </ul>}
    {item.canDecide && <div className="space-y-2">
      <label className="block text-sm">Decision note (required for rejection)
        <input className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" maxLength={500}
          value={reason} onChange={event => setReason(event.target.value)} />
      </label>
      <div className="flex gap-2">
        <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50" disabled={busy}
          onClick={() => void onDecide(item, 'approve', reason)}>Approve stage</button>
        <button className={button} disabled={busy || !reason.trim()}
          onClick={() => void onDecide(item, 'reject', reason)}>Reject payment</button>
      </div>
    </div>}
  </article>;
}

export default function PaymentApprovalsPage() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [history, setHistory] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch('/api/v1/payment_approvals?page=' + page + '&history=' + Number(history), { signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setItems(data.items);
    setTotal(data.total);
  }, [history, page]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).catch(error => {
      if (!controller.signal.aborted) setMessage(error.message);
    });
    return () => controller.abort();
  }, [load]);

  async function decide(item: ApprovalItem, action: 'approve' | 'reject', reason: string) {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/payment_approvals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueId: item.queueId, version: item.approval?.workflow.version, stage: item.approval?.stage, action, reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(action === 'reject' ? 'Payment rejected.' : data.status === 'queued' ? 'Final approval recorded. Payment released to the bank queue.' : 'Approval recorded.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to record the decision.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="max-w-5xl space-y-4">
    <h1 className="text-2xl font-semibold">Payment Approvals</h1>
    <div className="flex gap-2">
      <button className={button} aria-pressed={!history} disabled={busy} onClick={() => { setHistory(false); setPage(1); }}>Pending</button>
      <button className={button} aria-pressed={history} disabled={busy} onClick={() => { setHistory(true); setPage(1); }}>History</button>
      <button className={button} disabled={busy} onClick={() => void load().catch(error => setMessage(error.message))}>Refresh</button>
    </div>
    {message && <p role="status">{message}</p>}
    {items.length === 0 && <p className="text-sm text-slate-600">No payments on this page.</p>}
    {items.map(item => <ApprovalCard key={item.queueId + ':' + item.approval?.stage} item={item} busy={busy} onDecide={decide} />)}
    <div className="flex gap-2">
      <button className={button} disabled={page <= 1 || busy} onClick={() => setPage(page - 1)}>Previous</button>
      <button className={button} disabled={page * 25 >= total || busy} onClick={() => setPage(page + 1)}>Next</button>
    </div>
  </section>;
}
