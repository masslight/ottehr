import { useCallback, useEffect, useState } from 'react';
import { getNursingOrders, updateNursingOrder as updateNursingOrderApi } from 'src/api/api';
import { GetNursingOrdersInput, NursingOrdersSearchBy } from 'utils';
import { useApiClients } from '../../../../hooks/useAppClients';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetNursingOrders = ({
  encounterId,
  searchBy,
}: GetNursingOrdersInput & { searchBy?: NursingOrdersSearchBy }) => {
  const { oystehrZambda } = useApiClients();
  const [nursingOrders, setNursingOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

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
        response = await getNursingOrders(oystehrZambda, { encounterId, searchBy });
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
  }, [oystehrZambda, encounterId, searchBy]);

  // Initial fetch of nursing orders
  useEffect(() => {
    void fetchNursingOrders();
  }, [fetchNursingOrders]);

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
