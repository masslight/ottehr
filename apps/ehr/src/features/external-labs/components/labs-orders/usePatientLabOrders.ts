import { useCallback, useState, useEffect, ReactElement } from 'react';
import { EMPTY_PAGINATION, LabOrderDTO, DEFAULT_LABS_ITEMS_PER_PAGE } from 'utils';
import { useApiClients } from '../../../../hooks/useAppClients';
import { getLabOrders, deleteLabOrder } from '../../../../api/api';
import { DateTime } from 'luxon';
import { useDeleteLabOrderDialog } from './useDeleteLabOrderDialog';

export interface GetLabOrdersParameters {
  patientId?: string;
  encounterId?: string;
  testType?: string;
  visitDate?: string;
  pageIndex?: number;
  itemsPerPage?: number;
}

interface DeleteLabOrderParams {
  labOrderId: string;
  encounterId: string;
}

interface DeleteOrderParams {
  orderId: string;
  encounterId?: string;
}

interface UsePatientLabOrdersOptions {
  patientId?: string;
  encounterId?: string;
}

interface UsePatientLabOrdersResult {
  labOrders: LabOrderDTO[];
  loading: boolean;
  error: Error | null;
  totalPages: number;
  page: number;
  setPage: (page: number) => void;
  testTypeFilter: string;
  setTestTypeFilter: (filter: string) => void;
  visitDateFilter: DateTime | null;
  setVisitDateFilter: (date: DateTime | null) => void;
  fetchLabOrders: (params: Partial<GetLabOrdersParameters>) => Promise<void>;
  getCurrentSearchParams: () => Partial<GetLabOrdersParameters>;
  showPagination: boolean;
  deleteOrder: (params: DeleteOrderParams) => Promise<boolean>;
  onDeleteOrder: (order: LabOrderDTO, encounterIdOverride?: string) => void;
  DeleteOrderDialog: ReactElement | null;
}

export const usePatientLabOrders = (options: UsePatientLabOrdersOptions = {}): UsePatientLabOrdersResult => {
  const { oystehrZambda } = useApiClients();
  const { patientId, encounterId } = options;
  const [labOrders, setLabOrders] = useState<LabOrderDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [showPagination, setShowPagination] = useState(false);
  const [testTypeFilter, setTestTypeFilter] = useState('');
  const [visitDateFilter, setVisitDateFilter] = useState<DateTime | null>(null);

  const getCurrentSearchParamsWithoutPageIndex = useCallback((): Partial<GetLabOrdersParameters> => {
    const params: Partial<GetLabOrdersParameters> = {
      // pageIndex: 0,
      itemsPerPage: DEFAULT_LABS_ITEMS_PER_PAGE,
    };

    if (patientId) {
      params.patientId = patientId;
    }

    if (encounterId) {
      params.encounterId = encounterId;
    }

    if (testTypeFilter) {
      params.testType = testTypeFilter;
    }

    if (visitDateFilter && visitDateFilter.isValid) {
      try {
        params.visitDate = visitDateFilter.toISODate() || undefined;
      } catch (dateError) {
        console.error('Error formatting date:', dateError);
      }
    }

    return params;
  }, [patientId, encounterId, testTypeFilter, visitDateFilter]);

  const getCurrentSearchParamsForPage = useCallback(
    (pageNubmer: number): Partial<GetLabOrdersParameters> => {
      if (pageNubmer < 1) {
        throw Error('Page number must be greater than 0');
      }
      return { ...getCurrentSearchParamsWithoutPageIndex(), pageIndex: pageNubmer - 1 };
    },
    [getCurrentSearchParamsWithoutPageIndex]
  );

  const fetchLabOrders = useCallback(
    async (searchParams: Partial<GetLabOrdersParameters>): Promise<void> => {
      if (!oystehrZambda) {
        console.error('oystehrZambda is not defined');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        let response;
        try {
          response = await getLabOrders(oystehrZambda, searchParams);
        } catch (err) {
          response = {
            data: [],
            pagination: EMPTY_PAGINATION,
          };
          console.error('Error fetching lab orders:', err);
          setError(err instanceof Error ? err : new Error('Unknown error occurred'));
        }

        if (response?.data) {
          setLabOrders(response.data);

          if (response.pagination) {
            setTotalPages(response.pagination.totalPages || 1);
            setShowPagination(response.pagination.totalPages > 1);
          } else {
            setTotalPages(1);
            setShowPagination(false);
          }
        } else {
          setLabOrders([]);
          setTotalPages(1);
          setShowPagination(false);
        }
      } catch (error) {
        console.error('error with setting lab orders:', error);
        setError(error instanceof Error ? error : new Error('Unknown error occurred'));
        setLabOrders([]);
        setTotalPages(1);
        setShowPagination(false);
      } finally {
        setLoading(false);
      }
    },
    [oystehrZambda]
  );

  // initial fetch of lab orders, and when the search params change
  useEffect(() => {
    const searchParams = getCurrentSearchParamsForPage(1);
    void fetchLabOrders(searchParams);
  }, [fetchLabOrders, getCurrentSearchParamsForPage]);

  const didOrdersFetch = labOrders.length > 0;

  // fetch lab orders when the page changes
  useEffect(() => {
    // skip if the orders haven't been fetched yet, to prevent fetching when the page is first loaded
    if (didOrdersFetch) {
      const searchParams = getCurrentSearchParamsForPage(page);
      void fetchLabOrders(searchParams);
    }
  }, [fetchLabOrders, getCurrentSearchParamsForPage, didOrdersFetch, page]);

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
    [encounterId, oystehrZambda]
  );

  // handle delete dialog
  const { onDeleteOrder, DeleteOrderDialog } = useDeleteLabOrderDialog({
    deleteOrder,
    encounterId,
  });

  return {
    labOrders,
    loading,
    error,
    totalPages,
    page,
    setPage,
    testTypeFilter,
    setTestTypeFilter,
    visitDateFilter,
    setVisitDateFilter,
    fetchLabOrders,
    showPagination,
    deleteOrder,
    onDeleteOrder,
    DeleteOrderDialog,
    getCurrentSearchParams: getCurrentSearchParamsWithoutPageIndex,
  };
};
