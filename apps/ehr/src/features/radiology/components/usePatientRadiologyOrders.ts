import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import {
  CancelRadiologyOrderZambdaInput,
  EMPTY_PAGINATION,
  GetRadiologyOrderListZambdaInput,
  GetRadiologyOrderListZambdaOrder,
} from 'utils';
import { cancelRadiologyOrder, getRadiologyOrders } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';
import { useDeleteRadiologyOrderDialog } from './useDeleteRadiologyOrderDialog';

interface UsePatientRadiologyOrdersResult {
  orders: GetRadiologyOrderListZambdaOrder[];
  loading: boolean;
  error: Error | null;
  totalPages: number;
  page: number;
  setPage: (page: number) => void;
  fetchOrders: (params: GetRadiologyOrderListZambdaInput) => Promise<void>;
  getCurrentSearchParams: () => GetRadiologyOrderListZambdaInput;
  showPagination: boolean;
  deleteOrder: (params: CancelRadiologyOrderZambdaInput) => Promise<boolean>;
  showDeleteRadiologyOrderDialog: ({
    serviceRequestId,
    studyType,
  }: {
    serviceRequestId: string;
    studyType: string;
  }) => void;
  DeleteOrderDialog: ReactElement | null;
}

export const usePatientRadiologyOrders = (options: {
  patientId?: string;
  encounterIds?: string | string[];
  serviceRequestId?: string;
}): UsePatientRadiologyOrdersResult => {
  const { oystehrZambda } = useApiClients();

  // Memoize options to prevent unnecessary re-renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedOptions = useMemo(() => options, [JSON.stringify(options)]);

  const [orders, setOrders] = useState<GetRadiologyOrderListZambdaOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [showPagination, setShowPagination] = useState(false);

  const getCurrentSearchParamsWithoutPageIndex = useCallback((): GetRadiologyOrderListZambdaInput => {
    const params: GetRadiologyOrderListZambdaInput = {} as GetRadiologyOrderListZambdaInput;

    const { patientId, encounterIds, serviceRequestId } = memoizedOptions;

    if (patientId) {
      params.patientId = patientId;
    }

    if (encounterIds) {
      params.encounterIds = encounterIds;
    }

    if (serviceRequestId) {
      params.serviceRequestId = serviceRequestId;
    }

    return params;
  }, [memoizedOptions]);

  const getCurrentSearchParamsForPage = useCallback(
    (pageNumber: number): GetRadiologyOrderListZambdaInput => {
      if (pageNumber < 1) {
        throw Error('Page number must be greater than 0');
      }
      return { ...getCurrentSearchParamsWithoutPageIndex(), pageIndex: pageNumber - 1 };
    },
    [getCurrentSearchParamsWithoutPageIndex]
  );

  const fetchOrders = useCallback(
    async (searchParams: GetRadiologyOrderListZambdaInput): Promise<void> => {
      if (!oystehrZambda) {
        console.error('oystehrZambda is not defined');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        let response;
        try {
          response = await getRadiologyOrders(oystehrZambda, searchParams);
        } catch (err) {
          response = {
            data: [],
            pagination: EMPTY_PAGINATION,
          };
          console.error('Error fetching lab orders:', err);
          setError(err instanceof Error ? err : new Error('Unknown error occurred'));
        }

        if (response?.orders) {
          setOrders(response.orders);

          if (response.pagination) {
            setTotalPages(response.pagination.totalPages || 1);
            setShowPagination(response.pagination.totalPages > 1);
          } else {
            setTotalPages(1);
            setShowPagination(false);
          }
        } else {
          setOrders([]);
          setTotalPages(1);
          setShowPagination(false);
        }
      } catch (error) {
        console.error('error with setting lab orders:', error);
        setError(error instanceof Error ? error : new Error('Unknown error occurred'));
        setOrders([]);
        setTotalPages(1);
        setShowPagination(false);
      } finally {
        setLoading(false);
      }
    },
    [oystehrZambda]
  );

  // initial fetch of lab orders
  useEffect(() => {
    const searchParams = getCurrentSearchParamsForPage(1);
    let encounterIdsHasValue = false;
    if (searchParams.encounterIds) {
      if (Array.isArray(searchParams.encounterIds)) {
        // we don't want to call this until there are values in the array
        encounterIdsHasValue = searchParams.encounterIds.length > 0;
      } else {
        encounterIdsHasValue = true;
      }
    }
    if (searchParams.patientId || encounterIdsHasValue || searchParams.serviceRequestId) {
      void fetchOrders(searchParams);
    }
  }, [fetchOrders, getCurrentSearchParamsForPage]);

  const didOrdersFetch = orders.length > 0;

  // fetch orders when the page changes
  useEffect(() => {
    // skip if the orders haven't been fetched yet, to prevent fetching when the page is first loaded
    if (didOrdersFetch) {
      const searchParams = getCurrentSearchParamsForPage(page);
      void fetchOrders(searchParams);
    }
  }, [fetchOrders, getCurrentSearchParamsForPage, didOrdersFetch, page]);

  const handleDeleteOrder = useCallback(
    async (params: CancelRadiologyOrderZambdaInput): Promise<boolean> => {
      const { serviceRequestId } = params;

      if (!serviceRequestId) {
        console.error('Cannot cancel order: Missing order ID');
        setError(new Error('Missing order ID'));
        return false;
      }

      if (!oystehrZambda) {
        console.error('Cannot delete order: API client is not available');
        setError(new Error('API client is not available'));
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        await cancelRadiologyOrder(oystehrZambda, params);

        setPage(1);
        const searchParams = getCurrentSearchParamsForPage(1);
        await fetchOrders(searchParams);

        return true;
      } catch (err) {
        console.error('Error deleting radiology order:', err);

        const errorObj =
          err instanceof Error ? err : new Error(typeof err === 'string' ? err : 'Failed to delete lab order');

        setError(errorObj);

        return false;
      } finally {
        setLoading(false);
      }
    },
    [fetchOrders, getCurrentSearchParamsForPage, oystehrZambda]
  );

  // handle delete dialog
  const { showDeleteRadiologyOrderDialog, DeleteOrderDialog } = useDeleteRadiologyOrderDialog({
    deleteOrder: handleDeleteOrder,
  });

  return {
    orders,
    loading,
    error,
    totalPages,
    page,
    setPage,
    fetchOrders,
    showPagination,
    deleteOrder: handleDeleteOrder,
    showDeleteRadiologyOrderDialog,
    DeleteOrderDialog,
    getCurrentSearchParams: getCurrentSearchParamsWithoutPageIndex,
  };
};
