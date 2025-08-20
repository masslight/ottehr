import { useCallback, useEffect, useMemo, useState } from 'react';
import { getImmunizationOrders } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { GetImmunizationOrdersInput } from 'utils';

export const useGetImmunizationOrders = (
  input: GetImmunizationOrdersInput
): {
  immunizationOrders: any[];
  isLoading: boolean;
  error: Error | null;
  fetchImmunizationOrders: () => Promise<void>;
} => {
  const { oystehrZambda } = useApiClients();
  const [immunizationOrders, setImmunizationOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Memoize input to prevent unnecessary re-renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedInput = useMemo(() => input, [JSON.stringify(input)]);

  const fetchImmunizationOrders = useCallback(async (): Promise<void> => {
    if (!oystehrZambda) {
      console.error('oystehrZambda is not defined');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let response;
      try {
        response = await getImmunizationOrders(oystehrZambda, memoizedInput);
      } catch (err) {
        console.error('Error fetching immunization orders:', err);
        setError(err instanceof Error ? err : new Error('Unknown error occurred'));
      }

      if (response) {
        setImmunizationOrders(response as any[]);
      } else {
        setImmunizationOrders([]);
      }
    } catch (error) {
      console.error('error with setting immunization orders', error);
      setError(error instanceof Error ? error : new Error('Unknown error occurred'));
      setImmunizationOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [oystehrZambda, memoizedInput]);

  useEffect(() => {
    void fetchImmunizationOrders();
  }, [fetchImmunizationOrders]);

  return {
    immunizationOrders,
    isLoading,
    error,
    fetchImmunizationOrders,
  };
};
