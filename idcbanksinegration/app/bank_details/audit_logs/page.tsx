'use client';

import { useCallback, useEffect, useState } from 'react';
import Pagination from '@/app/components/Pagination';

interface AuditLogRow {
  id: number;
  userId: number | null;
  username: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  summary: string;
  details: unknown;
  ipAddress: string | null;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Login',
  LOGIN_FAILED: 'Login failed',
  LOGOUT: 'Logout',
  PAYMENT_POSTED: 'Payment posted',
  BANK_DETAILS_CREATED: 'Bank details created',
  BANK_DETAILS_UPDATED: 'Bank details updated',
  BANK_DETAILS_DELETED: 'Bank details deleted',
  CASHBOOK_POSTED: 'Cashbook posted',
  USER_CREATED: 'User created',
  USER_UPDATED: 'User updated',
  USER_DELETED: 'User deleted',
  ACCESS_DENIED: 'Access denied',
};

function actionBadgeClass(action: string): string {
  if (action.includes('FAILED') || action.includes('DENIED') || action.includes('DELETED')) {
    return 'bg-rose-50 text-rose-700 ring-rose-100';
  }
  if (action.includes('CREATED') || action === 'LOGIN' || action === 'PAYMENT_POSTED') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  }
  if (action.includes('UPDATED')) {
    return 'bg-amber-50 text-amber-700 ring-amber-100';
  }
  return 'bg-slate-100 text-slate-700 ring-slate-200';
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (actionFilter) params.set('action', actionFilter);
      if (search.trim()) params.set('search', search.trim());

      const response = await fetch(`/api/v1/audit_logs?${params.toString()}`, {
        credentials: 'include',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Could not load audit logs');
      }

      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setTotal(typeof data.total === 'number' ? data.total : 0);
      setActions(Array.isArray(data.actions) ? data.actions : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, actionFilter, search]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
        <p className="mt-1 text-sm text-slate-500">
          Track logins, payment posts, bank detail changes, and user management activity.
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search summary, user, or resource ID…"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:max-w-md"
        />
        <select
          value={actionFilter}
          onChange={(event) => {
            setActionFilter(event.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500"
        >
          <option value="">All actions</option>
          {actions.map((action) => (
            <option key={action} value={action}>
              {ACTION_LABELS[action] ?? action}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">When</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">User</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Action</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Summary</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">IP</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Loading audit logs…
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No audit entries found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="group hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {log.username ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${actionBadgeClass(log.action)}`}
                      >
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                    </td>
                    <td className="max-w-md px-4 py-3 text-slate-700">
                      <div>{log.summary}</div>
                      {expandedId === log.id && log.details ? (
                        <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-2 text-xs text-slate-600 ring-1 ring-slate-200">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {log.ipAddress ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {log.details ? (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId((current) => (current === log.id ? null : log.id))
                          }
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                        >
                          {expandedId === log.id ? 'Hide' : 'Details'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6">
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}
