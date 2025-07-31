import { useEffect, useRef } from 'react';

/**
 * Hook for handling onSuccess callbacks without infinite re-render loops.
 *
 * Issue: React Query v5 removed built-in onSuccess callbacks from useQuery.
 * When implementing them via useEffect, unstable callbacks cause infinite loops.
 *
 * This hook handles 3 scenarios:
 * 1. New data arrives → calls callback with new data
 * 2. Callback changes → calls new callback with existing data
 * 3. Both change simultaneously → calls new callback with new data (no duplicates)
 */
export function useSuccessQuery<T>(
  data: T,
  onSuccess?: (data: NonNullable<T> | null) => void,
  dependencies: React.DependencyList = []
): void {
  const previousDataRef = useRef<T | null>(null);

  useEffect(() => {
    if (data !== undefined && data !== previousDataRef.current && onSuccess) {
      onSuccess(data);
      previousDataRef.current = data;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSuccess, data, ...dependencies]);
}
