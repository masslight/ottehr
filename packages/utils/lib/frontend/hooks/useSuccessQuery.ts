import { useEffect, useRef } from 'react';

/**
 * Hook for handling onSuccess callbacks without infinite re-render loops.
 *
 * Problem: React Query v5 removed built-in onSuccess callbacks from useQuery.
 * When implementing them via useEffect, unstable callbacks cause infinite loops.
 *
 * This hook handles 3 scenarios:
 * 1. New data arrives → calls callback with new data
 * 2. Callback changes → calls new callback with existing data
 * 3. Both change simultaneously → calls new callback with new data (no duplicates)
 */
export function useSuccessQuery<T>(
  data: T | undefined,
  onSuccess?: (data: T) => void,
  dependencies: React.DependencyList = [],

  // todo: remove this; temporary for compatibility with old code, query should return required data type,
  // use case: onSuccess(data ? data : [])
  // useQuery should not return undefined, old approach is wrong
  handleNullData: boolean = false
): void {
  const previousDataRef = useRef<T | undefined>();
  const isDataChanged = (handleNullData || data) && data !== previousDataRef.current;

  // handle onSuccess callback changes
  useEffect(() => {
    if (isDataChanged) {
      onSuccess?.(data as T);
      previousDataRef.current = data;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSuccess, isDataChanged]);

  // handle data changes
  useEffect(() => {
    if (isDataChanged) {
      onSuccess?.(data as T);
      previousDataRef.current = data;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, isDataChanged, ...dependencies]);
}
