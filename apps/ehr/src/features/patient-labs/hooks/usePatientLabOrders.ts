import { useCallback, useState } from 'react';
import { EMPTY_PAGINATION, PaginatedLabOrderResponse } from 'utils';
import { useApiClients } from '../../../hooks/useAppClients';
import { getLabOrders } from '../../../api/api';

interface GetLabOrdersParameters {
  patientId?: string;
  testType?: string;
  visitDate?: string;
  page?: number;
  pageSize?: number;
}

export const usePatientLabOrders = (): {
  fetchLabOrders: (params: GetLabOrdersParameters) => Promise<PaginatedLabOrderResponse | undefined>;
  loading: boolean;
  error: Error | null;
} => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { oystehrZambda } = useApiClients();

  const fetchLabOrders = useCallback(
    async (params: GetLabOrdersParameters): Promise<PaginatedLabOrderResponse> => {
      if (!oystehrZambda) {
        console.error('oystehrZambda is not defined');
        return {
          data: [],
          pagination: EMPTY_PAGINATION,
        };
      }

      setLoading(true);
      setError(null);

      try {
        return getLabOrders(oystehrZambda, params);
      } catch (err) {
        console.error('Error fetching lab orders:', err);
        setError(err instanceof Error ? err : new Error('Unknown error occurred'));
        return {
          data: [],
          pagination: EMPTY_PAGINATION,
        };
      } finally {
        setLoading(false);
      }
    },
    [oystehrZambda]
  );

  return {
    fetchLabOrders,
    loading,
    error,
  };
};
