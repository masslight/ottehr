import { useCallback, useState, useEffect, ReactElement } from 'react';
import {
  EMPTY_PAGINATION,
  LabOrderDTO,
  DEFAULT_LABS_ITEMS_PER_PAGE,
  GetLabOrdersParameters,
  UpdateLabOrderResourceParams,
} from 'utils';
import { useApiClients } from '../../../../hooks/useAppClients';
import { getLabOrders, deleteLabOrder, updateLabOrderResources } from '../../../../api/api';
import { DateTime } from 'luxon';
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
  labOrders: LabOrderDTO[];
  loading: boolean;
  error: Error | null;
  totalPages: number;
  page: number;
  setPage: (page: number) => void;
  orderableItemCodeFilter: string;
  setOrderableItemCodeFilter: (filter: string) => void;
  visitDateFilter: DateTime | null;
  setVisitDateFilter: (date: DateTime | null) => void;
  fetchLabOrders: (params: GetLabOrdersParameters) => Promise<void>;
  getCurrentSearchParams: () => GetLabOrdersParameters;
  showPagination: boolean;
  deleteOrder: (params: DeleteOrderParams) => Promise<boolean>;
  onDeleteOrder: (order: LabOrderDTO, encounterIdOverride?: string) => void;
  DeleteOrderDialog: ReactElement | null;
  updateTask: ({ taskId, event }: UpdateLabOrderResourceParams) => Promise<void>;
}

export const usePatientLabOrders = (options: {
  patientId?: string;
  encounterId?: string;
  serviceRequestId?: string;
}): UsePatientLabOrdersResult => {
  const { oystehrZambda } = useApiClients();
  const { patientId, encounterId, serviceRequestId } = options;
  const [labOrders, setLabOrders] = useState<LabOrderDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [showPagination, setShowPagination] = useState(false);
  const [orderableItemCodeFilter, setOrderableItemCodeFilter] = useState('');
  const [visitDateFilter, setVisitDateFilter] = useState<DateTime | null>(null);

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

    if (orderableItemCodeFilter) {
      params.orderableItemCode = orderableItemCodeFilter;
    }

    if (visitDateFilter && visitDateFilter.isValid) {
      try {
        params.visitDate = visitDateFilter.toISODate() || undefined;
      } catch (dateError) {
        console.error('Error formatting date:', dateError);
      }
    }

    return params;
  }, [patientId, encounterId, serviceRequestId, orderableItemCodeFilter, visitDateFilter]);

  const getCurrentSearchParamsForPage = useCallback(
    (pageNubmer: number): GetLabOrdersParameters => {
      if (pageNubmer < 1) {
        throw Error('Page number must be greater than 0');
      }
      return { ...getCurrentSearchParamsWithoutPageIndex(), pageIndex: pageNubmer - 1 };
    },
    [getCurrentSearchParamsWithoutPageIndex]
  );

  const fetchLabOrders = useCallback(
    async (searchParams: GetLabOrdersParameters): Promise<void> => {
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
    if (searchParams.encounterId || searchParams.serviceRequestId || searchParams.patientId) {
      void fetchLabOrders(searchParams);
    }
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
        const searchParams = getCurrentSearchParamsForPage(1);
        await fetchLabOrders(searchParams);

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
    [encounterId, fetchLabOrders, getCurrentSearchParamsForPage, oystehrZambda]
  );

  // handle delete dialog
  const { onDeleteOrder, DeleteOrderDialog } = useDeleteLabOrderDialog({
    deleteOrder,
    encounterId,
  });

  const updateTask = useCallback(
    async ({ taskId, serviceRequestId, diagnosticReportId, event }: UpdateLabOrderResourceParams): Promise<void> => {
      if (!oystehrZambda) {
        console.error('oystehrZambda is not defined');
        return;
      }

      await updateLabOrderResources(oystehrZambda, { taskId, serviceRequestId, diagnosticReportId, event });
      await fetchLabOrders(getCurrentSearchParamsForPage(1));
    },
    [oystehrZambda, fetchLabOrders, getCurrentSearchParamsForPage]
  );

  return {
    labOrders,
    loading,
    error,
    totalPages,
    page,
    setPage,
    orderableItemCodeFilter,
    setOrderableItemCodeFilter,
    visitDateFilter,
    setVisitDateFilter,
    fetchLabOrders,
    showPagination,
    deleteOrder,
    onDeleteOrder,
    DeleteOrderDialog,
    getCurrentSearchParams: getCurrentSearchParamsWithoutPageIndex,
    updateTask,
  };
};
