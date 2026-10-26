'use client';

import { useEffect, useState } from 'react';
import type { PublicBankIntegration } from './bankCatalog';

export function useBankIntegrations() {
  const [banks, setBanks] = useState<PublicBankIntegration[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch('/api/v1/bank_integrations', { cache: 'no-store', signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Bank integrations are unavailable');
        if (!controller.signal.aborted) { setBanks(data.items); setError(''); }
      } catch (value) {
        if (!controller.signal.aborted) { setBanks([]); setError(value instanceof Error ? value.message : 'Bank integrations are unavailable'); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => { controller.abort(); clearInterval(timer); };
  }, []);
  return { banks, error, loading };
}
