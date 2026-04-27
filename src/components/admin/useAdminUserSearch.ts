'use client';

import { useEffect, useMemo, useState } from 'react';

export type AdminUserSearchItem = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  createdAt: string;
  tokenBalance: number;
  isAdmin: boolean;
};

type UseAdminUserSearchOptions = {
  includeGuestUsers?: boolean;
  includeDeleted?: boolean;
  limit?: number;
  minChars?: number;
  debounceMs?: number;
};

const DEFAULT_MIN_CHARS = 2;
const DEFAULT_DEBOUNCE_MS = 180;
const DEFAULT_LIMIT = 20;

export function useAdminUserSearch(options: UseAdminUserSearchOptions = {}) {
  const minChars = options.minChars ?? DEFAULT_MIN_CHARS;
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const includeGuestUsers = options.includeGuestUsers !== false;
  const includeDeleted = options.includeDeleted === true;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminUserSearchItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedQuery = useMemo(() => query.trim(), [query]);
  const isActiveQuery = normalizedQuery.length >= minChars;
  const isTooShort = normalizedQuery.length > 0 && normalizedQuery.length < minChars;

  useEffect(() => {
    if (!isActiveQuery) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsLoading(true);
        setError(null);

        const params = new URLSearchParams({
          q: normalizedQuery,
          limit: String(limit),
          includeGuestUsers: includeGuestUsers ? '1' : '0',
          includeDeleted: includeDeleted ? '1' : '0',
        });

        const response = await fetch(`/api/admin/users/search?${params.toString()}`, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          const message = payload?.error?.message || 'Search request failed.';
          throw new Error(message);
        }

        const items = Array.isArray(payload?.items) ? payload.items as AdminUserSearchItem[] : [];
        setResults(items);
      } catch (err) {
        if ((err as any)?.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Search request failed.');
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, debounceMs);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [debounceMs, includeDeleted, includeGuestUsers, isActiveQuery, limit, normalizedQuery]);

  return {
    query,
    setQuery,
    normalizedQuery,
    results,
    isLoading,
    error,
    isActiveQuery,
    isTooShort,
    minChars,
  };
}
