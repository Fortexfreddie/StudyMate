"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiClientError } from "@/lib/api";

interface UseApiState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Minimal data-fetching hook for GET-style calls.
 *
 * Runs `fetcher` on mount (and whenever a value in `deps` changes), exposing
 * loading/error state and a `refetch`. Errors are surfaced as the backend's
 * human-readable `detail` when available.
 *
 * @example
 *   const { data, isLoading, error, refetch } = useApi(() => api.documents.list(), []);
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: readonly unknown[] = []
): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The fetcher identity changes every render; we intentionally key the effect on
  // the caller-provided deps instead.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    fetcher()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof ApiClientError
            ? err.detail
            : "Something went wrong. Please try again."
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    const cleanup = run();
    return cleanup;
  }, [run]);

  return { data, isLoading, error, refetch: run };
}
