'use client';

import React from 'react';

type Props = {
  page: number;
  pageSize: number;
  total: number | null;
  onPageChange: (newPage: number) => void;
  onPageSizeChange?: (newSize: number) => void;
};

export default function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange }: Props) {
  const maxPage = total ? Math.max(1, Math.ceil(total / pageSize)) : null;

  return (
    <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between">
      <div className="text-xs font-semibold text-slate-500">
        {total !== null ? (
          <span>
            Showing {total > 0 ? (page - 1) * pageSize + 1 : 0} – {Math.min(page * pageSize, total)} of {total} payment records
          </span>
        ) : (
          <span>Showing page {page}</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Per Page:</span>
            <select
              value={pageSize}
              onChange={(e) => { onPageSizeChange(parseInt(e.target.value, 10)); onPageChange(1); }}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20"
              aria-label="Per page"
            >
              {[10, 25, 50, 100].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-50 transition-all outline-none"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>

          <button
            type="button"
            onClick={() => onPageChange(maxPage ? Math.min(maxPage, page + 1) : page + 1)}
            disabled={maxPage !== null && page >= maxPage}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-50 transition-all outline-none"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
