'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Permission } from './permissions';

export interface PortalUser {
  id: number;
  username: string;
  role: string;
  permissions: Permission[];
}

export function usePortalUser() {
  const [user, setUser] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/users/me', { credentials: 'include' });
      if (!response.ok) {
        setUser(null);
        return;
      }
      const data = await response.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasPermission = useCallback(
    (permission: Permission) => user?.permissions?.includes(permission) ?? false,
    [user],
  );

  return { user, loading, refresh, hasPermission };
}
