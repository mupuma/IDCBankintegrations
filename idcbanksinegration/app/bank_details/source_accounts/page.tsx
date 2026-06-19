'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

interface SourceBankRow {
  bank: string;
  name: string | null;
  accountNumber: string | null;
  transit: string | null;
  contact?: string | null;
  phone?: string | null;
  hasLocalDetails: boolean;
  detailsComplete: boolean;
}

interface LocalSourceAccount {
  id: number;
  bank: string;
  name: string | null;
  accountNumber: string | null;
  branchCode: string | null;
  contact: string | null;
  phone: string | null;
  isActive: boolean;
  notes: string | null;
}

interface EditForm {
  name: string;
  accountNumber: string;
  branchCode: string;
  contact: string;
  phone: string;
  notes: string;
  isActive: boolean;
}

const emptyForm = (): EditForm => ({
  name: '',
  accountNumber: '',
  branchCode: '',
  contact: '',
  phone: '',
  notes: '',
  isActive: true,
});

function StatusBadge({ complete, hasLocal }: { complete: boolean; hasLocal: boolean }) {
  if (complete) {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
        Ready
      </span>
    );
  }
  if (hasLocal) {
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
        Incomplete
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-700">
      Missing
    </span>
  );
}

export default function SourceAccountsPage() {
  const [rows, setRows] = useState<SourceBankRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editingBank, setEditingBank] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm>(emptyForm());
  const [showCreate, setShowCreate] = useState(false);
  const [newBank, setNewBank] = useState('');

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/v1/source_banks', { credentials: 'include' });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Could not load source accounts');
      }
      setRows(Array.isArray(data.items) ? data.items : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load source accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      [row.bank, row.name, row.accountNumber, row.transit]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [rows, search]);

  const missingCount = rows.filter((row) => !row.detailsComplete).length;

  async function openEdit(row: SourceBankRow) {
    setEditingBank(row.bank);
    setForm({
      name: row.name || '',
      accountNumber: row.accountNumber || '',
      branchCode: row.transit || '',
      contact: row.contact || '',
      phone: row.phone || '',
      notes: '',
      isActive: true,
    });
    setShowCreate(false);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/v1/source_accounts/${encodeURIComponent(row.bank)}`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok && data?.local) {
        const local = data.local as LocalSourceAccount;
        setForm({
          name: local.name || row.name || '',
          accountNumber: local.accountNumber || row.accountNumber || '',
          branchCode: local.branchCode || row.transit || '',
          contact: local.contact || row.contact || '',
          phone: local.phone || row.phone || '',
          notes: local.notes || '',
          isActive: local.isActive !== false,
        });
      }
    } catch {
      // merged row values are enough as a fallback
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!editingBank) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/v1/source_accounts/${encodeURIComponent(editingBank)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to save source account');
      }

      setMessage(`Saved details for ${editingBank}.`);
      setEditingBank(null);
      setForm(emptyForm());
      await loadRows();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save source account');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    const bank = newBank.trim().toUpperCase();
    if (!bank) {
      setError('Bank code is required.');
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/v1/source_accounts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bank, ...form }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to create source account');
      }

      setMessage(`Created source account for ${bank}.`);
      setShowCreate(false);
      setNewBank('');
      setForm(emptyForm());
      await loadRows();
      setEditingBank(bank);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create source account');
    } finally {
      setSaving(false);
    }
  }

  async function handleClearLocal(bank: string) {
    if (!window.confirm(`Remove local details for ${bank}? Sage values will remain if available.`)) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/v1/source_accounts/${encodeURIComponent(bank)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to remove local details');
      }

      setMessage(`Removed local details for ${bank}.`);
      if (editingBank === bank) {
        setEditingBank(null);
        setForm(emptyForm());
      }
      await loadRows();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove local details');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Configuration</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Source Accounts</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Sage bank codes are listed here, but account numbers and branch codes are usually blank.
            Maintain the missing payment details locally so posted payments can use them as the source account.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/bank_details/payments"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back to Payments
          </Link>
          <button
            type="button"
            onClick={() => {
              setShowCreate(true);
              setEditingBank(null);
              setForm(emptyForm());
              setNewBank('');
            }}
            className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Add Source Account
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Total Banks</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{rows.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Ready for Payments</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{rows.length - missingCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Need Details</p>
          <p className="mt-2 text-2xl font-bold text-rose-600">{missingCount}</p>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by bank code, name, account, or branch..."
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Bank</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Name</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Account</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Branch</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Status</th>
                <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">
                    Loading source accounts...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">
                    No source accounts found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.bank} className="hover:bg-slate-50/70">
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">{row.bank}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{row.name || '—'}</td>
                    <td className="px-6 py-4 font-mono text-sm text-slate-600">{row.accountNumber || '—'}</td>
                    <td className="px-6 py-4 font-mono text-sm text-slate-600">{row.transit || '—'}</td>
                    <td className="px-6 py-4">
                      <StatusBadge complete={row.detailsComplete} hasLocal={row.hasLocalDetails} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        {row.hasLocalDetails ? 'Edit' : 'Add details'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(editingBank || showCreate) ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">
                {showCreate ? 'Add Source Account' : `Edit ${editingBank}`}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                These values are stored locally and used when posting payments.
              </p>
            </div>

            <form onSubmit={showCreate ? handleCreate : handleSave} className="space-y-4 px-6 py-5">
              {showCreate ? (
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                    Bank code
                  </label>
                  <input
                    value={newBank}
                    onChange={(event) => setNewBank(event.target.value.toUpperCase())}
                    maxLength={8}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  />
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Account name</label>
                <input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Account number</label>
                  <input
                    value={form.accountNumber}
                    onChange={(event) => setForm((prev) => ({ ...prev, accountNumber: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Branch / transit</label>
                  <input
                    value={form.branchCode}
                    onChange={(event) => setForm((prev) => ({ ...prev, branchCode: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Contact</label>
                  <input
                    value={form.contact}
                    onChange={(event) => setForm((prev) => ({ ...prev, contact: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Phone</label>
                  <input
                    value={form.phone}
                    onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  rows={3}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBank(null);
                      setShowCreate(false);
                      setForm(emptyForm());
                    }}
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    Cancel
                  </button>
                  {!showCreate && editingBank ? (
                    <button
                      type="button"
                      onClick={() => void handleClearLocal(editingBank)}
                      disabled={saving}
                      className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"
                    >
                      Clear local
                    </button>
                  ) : null}
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
