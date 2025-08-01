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
export function useErrorQuery<T = any>(
  error: T,
  onError?: (error: NonNullable<T>) => void,
  dependencies: React.DependencyList = []
): void {
  const previousDataRef = useRef<T | null>(null);

  useEffect(() => {
    if (error && error !== previousDataRef.current && onError) {
      onError(error);
      previousDataRef.current = error;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onError, error, ...dependencies]);
}
