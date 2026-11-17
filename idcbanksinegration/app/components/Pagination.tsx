'use client';

import React, { useEffect, useRef } from 'react';

/**
 * Shared pagination bar (1-based pages).
 *
 * Scroll reset: place the bar inside an element marked `data-table-card`, and
 * mark the table's own scroll box with `data-table-scroll`. On every page or
 * page-size change the scroll box is reset to the top and the top of the card
 * is brought into view. Without the markers the bar's parent element is used.
 */
type Props = {
  page: number;
  pageSize: number;
  total: number | null;
  onPageChange: (newPage: number) => void;
  onPageSizeChange?: (newSize: number) => void;
  /** Plural noun for the rows, e.g. "payments", "audit entries". */
  itemLabel?: string;
  pageSizeOptions?: number[];
  disabled?: boolean;
};

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];

type PageToken = number | 'start-gap' | 'end-gap';

export function pageTokens(current: number, last: number): PageToken[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  let start = Math.max(2, Math.min(current - 1, last - 4));
  let end = Math.min(last - 1, Math.max(current + 1, 5));
  // A gap that would hide a single page shows that page instead.
  if (start === 3) start = 2;
  if (end === last - 2) end = last - 1;
  const tokens: PageToken[] = [1];
  if (start > 2) tokens.push('start-gap');
  for (let p = start; p <= end; p++) tokens.push(p);
  if (end < last - 1) tokens.push('end-gap');
  tokens.push(last);
  return tokens;
}

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1';
const navButton = `inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-1.5 text-slate-600 transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40 ${focusRing}`;

function Icon({ d }: { d: string }) {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
}

export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'items',
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  disabled = false,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const lastPage = total !== null ? Math.max(1, Math.ceil(total / pageSize)) : null;

  // Clamp when the list shrinks below the current page (filter, delete, size change).
  useEffect(() => {
    if (lastPage !== null && page > lastPage) onPageChange(lastPage);
  }, [page, lastPage, onPageChange]);

  const currentPage = lastPage !== null ? Math.min(Math.max(1, page), lastPage) : Math.max(1, page);

  const resetScroll = () => {
    const root = rootRef.current;
    if (!root) return;
    const card = (root.closest('[data-table-card]') as HTMLElement | null) ?? root.parentElement;
    if (!card) return;
    const scrollBox = card.querySelector<HTMLElement>('[data-table-scroll]');
    if (scrollBox) scrollBox.scrollTop = 0;
    // Measure now, while the card is still laid out; the rows above it do not change.
    const top = card.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.5) {
      card.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  };

  const goTo = (target: number) => {
    const bounded = lastPage !== null ? Math.min(Math.max(1, target), lastPage) : Math.max(1, target);
    if (bounded === currentPage) return;
    onPageChange(bounded);
    resetScroll();
  };

  const changeSize = (size: number) => {
    onPageSizeChange?.(size);
    onPageChange(1);
    resetScroll();
  };

  const first = total && total > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const lastItem = total !== null ? Math.min(currentPage * pageSize, total) : 0;
  const atStart = currentPage <= 1;
  const atEnd = lastPage !== null && currentPage >= lastPage;

  return (
    <div
      ref={rootRef}
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-slate-100 bg-white px-4 py-4 sm:px-6"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-slate-500" aria-live="polite">
        {total !== null ? (
          <span>
            Showing <span className="tabular-nums text-slate-700">{first.toLocaleString('en-GB')}</span>–<span className="tabular-nums text-slate-700">{lastItem.toLocaleString('en-GB')}</span> of{' '}
            <span className="tabular-nums text-slate-700">{total.toLocaleString('en-GB')}</span> {itemLabel}
          </span>
        ) : null}
        <span>
          Page <span className="tabular-nums text-slate-700">{currentPage}</span>
          {lastPage !== null ? <> of <span className="tabular-nums text-slate-700">{lastPage}</span></> : null}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {onPageSizeChange ? (
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            Per page
            <select
              value={pageSize}
              disabled={disabled}
              onChange={(e) => changeSize(parseInt(e.target.value, 10))}
              className={`rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold normal-case tracking-normal text-slate-700 ${focusRing}`}
            >
              {(pageSizeOptions.includes(pageSize) ? pageSizeOptions : [...pageSizeOptions, pageSize].sort((a, b) => a - b)).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        ) : null}

        <nav aria-label="Pagination" className="flex flex-wrap items-center gap-1">
          {lastPage !== null ? (
            <button type="button" className={navButton} onClick={() => goTo(1)} disabled={disabled || atStart} aria-label="First page" title="First page">
              <Icon d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
            </button>
          ) : null}
          <button type="button" className={navButton} onClick={() => goTo(currentPage - 1)} disabled={disabled || atStart} aria-label="Previous page" title="Previous page">
            <Icon d="M15 19l-7-7 7-7" />
          </button>

          {lastPage !== null
            ? pageTokens(currentPage, lastPage).map((token) =>
                typeof token === 'number' ? (
                  <button
                    key={token}
                    type="button"
                    onClick={() => goTo(token)}
                    disabled={disabled}
                    aria-label={`Page ${token}`}
                    aria-current={token === currentPage ? 'page' : undefined}
                    className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-semibold tabular-nums transition-colors ${focusRing} ${
                      token === currentPage
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {token}
                  </button>
                ) : (
                  <span key={token} className="inline-flex h-8 min-w-6 items-center justify-center text-xs text-slate-400" aria-hidden="true">
                    …
                  </span>
                ),
              )
            : null}

          <button type="button" className={navButton} onClick={() => goTo(currentPage + 1)} disabled={disabled || atEnd} aria-label="Next page" title="Next page">
            <Icon d="M9 5l7 7-7 7" />
          </button>
          {lastPage !== null ? (
            <button type="button" className={navButton} onClick={() => goTo(lastPage)} disabled={disabled || atEnd} aria-label="Last page" title="Last page">
              <Icon d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </button>
          ) : null}
        </nav>
      </div>
    </div>
  );
}
