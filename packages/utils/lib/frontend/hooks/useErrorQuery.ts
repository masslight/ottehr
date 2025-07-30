import { useEffect, useRef } from 'react';

/**
 * Hook for handling onError callbacks without infinite re-render loops.
 *
 * Problem: React Query v5 removed built-in onError callbacks from useQuery.
 * When implementing them via useEffect, unstable callbacks cause infinite loops.
 *
 * This hook handles 3 scenarios:
 * 1. New error occurs → calls callback with new error
 * 2. Callback changes → calls new callback with existing error
 * 3. Both change simultaneously → calls new callback with new error (no duplicates)
 */
export function useErrorQuery<T = unknown>(
  error: T | null | undefined,
  onError?: (error: T) => void,
  dependencies: React.DependencyList = []
): void {
  const previousErrorRef = useRef<T | null | undefined>();
  const isErrorChanged = error && error !== previousErrorRef.current;

  // handle onError callback changes
  useEffect(() => {
    if (isErrorChanged) {
      onError?.(error);
      previousErrorRef.current = error;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onError, isErrorChanged]);

  // handle error changes
  useEffect(() => {
    if (isErrorChanged) {
      onError?.(error);
      previousErrorRef.current = error;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, isErrorChanged, ...dependencies]);
}
