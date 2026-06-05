'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { BankQueueItem } from '@/app/lib/bankQueue';

const ACTIVE_QUEUE_STATUSES = new Set(['queued', 'processing']);
const ACTIVE_POLL_MS = 5000;
const IDLE_POLL_MS = 30000;

function getPollDelay(items: BankQueueItem[]): number {
  const hasActiveItems = items.some((item) => ACTIVE_QUEUE_STATUSES.has(item.status));
  return hasActiveItems ? ACTIVE_POLL_MS : IDLE_POLL_MS;
}

type UseAdaptiveQueuePollingOptions = {
  enabled?: boolean;
  onPoll?: (items: BankQueueItem[]) => void;
};

export function useAdaptiveQueuePolling(
  poll: () => Promise<BankQueueItem[]>,
  deps: unknown[] = [],
  options: UseAdaptiveQueuePollingOptions = {},
) {
  const { enabled = true, onPoll } = options;
  const itemsRef = useRef<BankQueueItem[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef(poll);
  const onPollRef = useRef(onPoll);

  pollRef.current = poll;
  onPollRef.current = onPoll;

  const clearScheduledPoll = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const scheduleNextPoll = useCallback((items: BankQueueItem[]) => {
    itemsRef.current = items;
    clearScheduledPoll();

    if (!enabled || document.hidden) {
      return;
    }

    timeoutRef.current = setTimeout(async () => {
      try {
        const nextItems = await pollRef.current();
        onPollRef.current?.(nextItems);
        scheduleNextPoll(nextItems);
      } catch {
        scheduleNextPoll(itemsRef.current);
      }
    }, getPollDelay(items));
  }, [clearScheduledPoll, enabled]);

  const refresh = useCallback(async () => {
    const items = await pollRef.current();
    onPollRef.current?.(items);
    scheduleNextPoll(items);
    return items;
  }, [scheduleNextPoll]);

  useEffect(() => {
    if (!enabled) {
      clearScheduledPoll();
      return;
    }

    let cancelled = false;

    const runInitialPoll = async () => {
      try {
        const items = await pollRef.current();
        if (cancelled) return;
        onPollRef.current?.(items);
        scheduleNextPoll(items);
      } catch {
        if (!cancelled) {
          scheduleNextPoll(itemsRef.current);
        }
      }
    };

    void runInitialPoll();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearScheduledPoll();
        return;
      }
      void refresh();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      clearScheduledPoll();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, clearScheduledPoll, refresh, ...deps]);

  return { refresh };
}
