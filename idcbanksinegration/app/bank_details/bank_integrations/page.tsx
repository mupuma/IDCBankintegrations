'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePortalUser } from '@/app/lib/usePortalUser';
import { PERMISSIONS } from '@/app/lib/permissions';
import AgentOnboarding from './AgentOnboarding';

type Registration = { bankCode: string; displayName: string; enabled: boolean; status: string; adapter: string; revision: number; transactionTypes: string[] };

export default function BankIntegrationsPage() {
  const { hasPermission, loading } = usePortalUser();
  const [items, setItems] = useState<Registration[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [bankCode, setBankCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const allowed = hasPermission(PERMISSIONS.BANK_INTEGRATIONS_MANAGE);
  const load = useCallback(async () => {
    const response = await fetch('/api/v1/bank_integrations?administration=true', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to load bank integrations');
    setItems(data.items);
  }, []);
  useEffect(() => { if (allowed) void load().catch(value => setError(value.message)); }, [allowed, load]);

  async function save(row?: Registration) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/v1/bank_integrations', {
        method: row ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row ? { bankCode: row.bankCode, displayName: row.displayName, enabled: row.enabled, revision: row.revision } : { bankCode, displayName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save bank integration');
      if (!row) { setBankCode(''); setDisplayName(''); }
      setMessage(row ? `${row.bankCode} saved.` : 'Bank draft created. Agent onboarding is required before activation.');
      await load();
    } catch (value) { setError(value instanceof Error ? value.message : 'Unable to save bank integration'); }
    finally { setBusy(false); }
  }

  if (loading) return <p className="p-8">Loading permissions...</p>;
  if (!allowed) return <p className="p-8 text-rose-700">Bank integration administration permission is required.</p>;
  return <div className="space-y-6">
    <div className="rounded-3xl border bg-white p-6">
      <h1 className="text-3xl font-bold text-slate-900">Bank Integrations</h1>
      <p className="mt-2 text-sm text-slate-600">Choose which banks accept new payments in this deployment. Existing queue items, bank reporting and recovery remain available when a bank is disabled.</p>
      {error ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-rose-800">{error}</p> : null}
      {message ? <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-emerald-800">{message}</p> : null}
      <button type="button" disabled={busy} onClick={() => { void load().catch(value => setError(value.message)); }} className="mt-4 rounded-xl border px-4 py-2 disabled:opacity-40">Refresh registrations</button>
    </div>
    <div className="space-y-4">
      {items.map(row => <div key={row.bankCode} className="rounded-3xl border bg-white p-6"><form onSubmit={event => { event.preventDefault(); void save(row); }} className="grid gap-4 md:grid-cols-[1fr_2fr_auto]">
        <div><h2 className="font-bold">{row.bankCode}</h2><p className="text-sm text-slate-500">{row.status === 'ready' ? 'Existing bank adapter' : 'Awaiting agent onboarding'}</p></div>
        <label className="text-sm font-semibold">Display name
          <input required maxLength={120} value={row.displayName} disabled={busy} onChange={event => setItems(previous => previous.map(item => item.bankCode === row.bankCode ? { ...item, displayName: event.target.value } : item))} className="mt-1 block w-full rounded-xl border p-3 font-normal" />
        </label>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={row.enabled} disabled={busy || row.status !== 'ready'} onChange={event => setItems(previous => previous.map(item => item.bankCode === row.bankCode ? { ...item, enabled: event.target.checked } : item))} />Accept new payments</label>
          <button disabled={busy} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">Save</button>
        </div>
        <p className="text-sm text-slate-600 md:col-span-3">{row.transactionTypes.length ? `Payment types: ${row.transactionTypes.map(type => type === 'TT' ? 'SWIFT' : type === 'DDACCT' ? 'DDACC' : type).join(', ')}` : 'This bank cannot accept payments until a compatible agent has been connected and validated.'}</p>
      </form>{row.adapter === 'agent-v1' && <div className="mt-4"><AgentOnboarding bankCode={row.bankCode} /></div>}</div>)}
    </div>
    <form onSubmit={event => { event.preventDefault(); void save(); }} className="space-y-4 rounded-3xl border bg-white p-6">
      <h2 className="text-xl font-bold">Register another bank</h2>
      <p className="text-sm text-slate-600">Create an onboarding draft. Registering a name does not enable payment processing.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">Bank code<input required minLength={2} maxLength={20} pattern="[A-Z][A-Z0-9_]{1,19}" value={bankCode} onChange={event => setBankCode(event.target.value.toUpperCase())} disabled={busy} className="mt-1 block w-full rounded-xl border p-3" /></label>
        <label className="text-sm font-semibold">Bank name<input required maxLength={120} value={displayName} onChange={event => setDisplayName(event.target.value)} disabled={busy} className="mt-1 block w-full rounded-xl border p-3" /></label>
      </div>
      <button disabled={busy} className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-40">Create bank draft</button>
    </form>
  </div>;
}
