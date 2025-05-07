import { ReactElement, useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_LABS_ITEMS_PER_PAGE,
  EMPTY_PAGINATION,
  GetLabOrdersParameters,
  GetRadiologyOrderListZambdaInput,
  GetRadiologyOrderListZambdaOrder,
} from 'utils';
import { deleteLabOrder, getRadiologyOrders } from '../../../../api/api';
import { useApiClients } from '../../../../hooks/useAppClients';
import { useDeleteLabOrderDialog } from './useDeleteLabOrderDialog';

interface DeleteLabOrderParams {
  labOrderId: string;
  encounterId: string;
}

interface DeleteOrderParams {
  orderId: string;
  encounterId?: string;
}

interface UsePatientLabOrdersResult {
  orders: GetRadiologyOrderListZambdaOrder[];
  loading: boolean;
  error: Error | null;
  totalPages: number;
  page: number;
  setPage: (page: number) => void;
  fetchOrders: (params: GetRadiologyOrderListZambdaInput) => Promise<void>;
  getCurrentSearchParams: () => GetRadiologyOrderListZambdaInput;
  showPagination: boolean;
  deleteOrder: (params: DeleteOrderParams) => Promise<boolean>;
  showDeleteLabOrderDialog: ({
    serviceRequestId,
    testItemName,
  }: {
    serviceRequestId: string;
    testItemName: string;
  }) => void;
  DeleteOrderDialog: ReactElement | null;
}

export const usePatientRadiologyOrders = (options: {
  patientId?: string;
  encounterId?: string;
  serviceRequestId?: string;
}): UsePatientLabOrdersResult => {
  const { oystehrZambda } = useApiClients();
  const { patientId, encounterId, serviceRequestId } = options;
  const [orders, setOrders] = useState<GetRadiologyOrderListZambdaOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [showPagination, setShowPagination] = useState(false);

  const getCurrentSearchParamsWithoutPageIndex = useCallback((): GetLabOrdersParameters => {
    const params: GetLabOrdersParameters = {
      // pageIndex: 0,
      itemsPerPage: DEFAULT_LABS_ITEMS_PER_PAGE,
    } as GetLabOrdersParameters;

    if (patientId) {
      params.patientId = patientId;
    }

    if (encounterId) {
      params.encounterId = encounterId;
    }

    if (serviceRequestId) {
      params.serviceRequestId = serviceRequestId;
    }

    return params;
  }, [patientId, encounterId, serviceRequestId]);

  const getCurrentSearchParamsForPage = useCallback(
    (pageNubmer: number): GetLabOrdersParameters => {
      if (pageNubmer < 1) {
        throw Error('Page number must be greater than 0');
      }
      return { ...getCurrentSearchParamsWithoutPageIndex(), pageIndex: pageNubmer - 1 };
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
    void fetchOrders(searchParams);
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

  const deleteOrder = useCallback(
    async (params: DeleteOrderParams): Promise<boolean> => {
      const { orderId, encounterId: paramEncounterId } = params;
      const effectiveEncounterId = paramEncounterId || encounterId;

      if (!orderId) {
        console.error('Cannot delete lab order: Missing order ID');
        setError(new Error('Missing lab order ID'));
        return false;
      }

      if (!oystehrZambda) {
        console.error('Cannot delete lab order: API client is not available');
        setError(new Error('API client is not available'));
        return false;
      }

      if (!effectiveEncounterId) {
        console.error('Cannot delete lab order: Missing encounter ID');
        setError(new Error('Encounter ID is required to delete lab order'));
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        const deleteParams: DeleteLabOrderParams = {
          labOrderId: orderId,
          encounterId: effectiveEncounterId,
        };

        await deleteLabOrder(oystehrZambda, deleteParams);

        setPage(1);
        const searchParams = getCurrentSearchParamsForPage(1);
        await fetchOrders(searchParams);

        return true;
      } catch (err) {
        console.error('Error deleting lab order:', err);

        const errorObj =
          err instanceof Error ? err : new Error(typeof err === 'string' ? err : 'Failed to delete lab order');

        setError(errorObj);

        return false;
      } finally {
        setLoading(false);
      }
    },
    [encounterId, fetchOrders, getCurrentSearchParamsForPage, oystehrZambda]
  );

  // handle delete dialog
  const { onDeleteOrder, DeleteOrderDialog } = useDeleteLabOrderDialog({
    deleteOrder,
    encounterId,
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
    deleteOrder,
    onDeleteOrder,
    DeleteOrderDialog,
    getCurrentSearchParams: getCurrentSearchParamsWithoutPageIndex,
  };
};
