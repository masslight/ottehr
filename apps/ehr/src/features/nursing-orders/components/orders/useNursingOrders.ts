import { useCallback, useEffect, useMemo, useState } from 'react';
import { getNursingOrders, updateNursingOrder as updateNursingOrderApi } from 'src/api/api';
import { GetNursingOrdersInput } from 'utils';
import { useApiClients } from '../../../../hooks/useAppClients';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetNursingOrders = ({ searchBy }: GetNursingOrdersInput) => {
  const { oystehrZambda } = useApiClients();
  const [nursingOrders, setNursingOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Memoize searchBy to prevent unnecessary re-renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedSearchBy = useMemo(() => searchBy, [JSON.stringify(searchBy)]);

  const fetchNursingOrders = useCallback(async (): Promise<void> => {
    if (!oystehrZambda) {
      console.error('oystehrZambda is not defined');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let response;
      try {
        response = await getNursingOrders(oystehrZambda, { searchBy: memoizedSearchBy });
      } catch (err) {
        console.error('Error fetching nursing orders:', err);
        setError(err instanceof Error ? err : new Error('Unknown error occurred'));
      }

      if (response?.data) {
        setNursingOrders(response.data as any[]);
      } else {
        setNursingOrders([]);
      }
    } catch (error) {
      console.error('error with setting nursing orders:', error);
      setError(error instanceof Error ? error : new Error('Unknown error occurred'));
      setNursingOrders([]);
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, memoizedSearchBy]);

  // Initial fetch of nursing orders
  useEffect(() => {
    if (!memoizedSearchBy?.value || (Array.isArray(memoizedSearchBy.value) && memoizedSearchBy.value.length === 0)) {
      console.log('search values loading');
      return;
    } else {
      void fetchNursingOrders();
    }
  }, [fetchNursingOrders, memoizedSearchBy]);

  return {
    nursingOrders,
    loading,
    error,
    fetchNursingOrders,
  };
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useUpdateNursingOrder = ({
  serviceRequestId,
  action,
}: {
  serviceRequestId?: string;
  action: 'CANCEL ORDER' | 'COMPLETE ORDER';
}) => {
  const { oystehrZambda } = useApiClients();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const updateNursingOrder = useCallback(async (): Promise<void> => {
    if (!oystehrZambda) {
      console.error('oystehrZambda is not defined');
      return;
    }

    if (!serviceRequestId) {
      console.warn('ServiceRequestId is undefined — skipping update.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      try {
        await updateNursingOrderApi(oystehrZambda, { serviceRequestId, action });
      } catch (err) {
        console.error('Error updating nursing order:', err);
        setError(err instanceof Error ? err : new Error('Unknown error occurred'));
      }
    } catch (error) {
      console.error('error with setting nursing order:', error);
      setError(error instanceof Error ? error : new Error('Unknown error occurred'));
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, serviceRequestId, action]);

  return {
    loading,
    error,
    updateNursingOrder,
  };
};
