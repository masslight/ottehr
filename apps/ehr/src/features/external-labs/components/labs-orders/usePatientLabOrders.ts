import { useCallback, useState, useEffect, ReactElement, useMemo } from 'react';
import {
  EMPTY_PAGINATION,
  LabOrderDTO,
  DEFAULT_LABS_ITEMS_PER_PAGE,
  GetLabOrdersParameters,
  DeleteLabOrderParams,
  LabOrdersSearchBy,
  TaskReviewedParameters,
  SpecimenDateChangedParameters,
} from 'utils';
import { useApiClients } from '../../../../hooks/useAppClients';
import { getLabOrders, deleteLabOrder, updateLabOrderResources } from '../../../../api/api';
import { DateTime } from 'luxon';
import { useDeleteLabOrderDialog } from './useDeleteLabOrderDialog';

interface UsePatientLabOrdersResult<SearchBy extends LabOrdersSearchBy> {
  labOrders: LabOrderDTO<SearchBy>[];
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
  deleteLabOrder: (params: DeleteLabOrderParams) => Promise<boolean>;
  showDeleteLabOrderDialog: ({
    serviceRequestId,
    testItemName,
  }: {
    serviceRequestId: string;
    testItemName: string;
  }) => void;
  DeleteOrderDialog: ReactElement | null;
  markTaskAsReviewed: (parameters: TaskReviewedParameters) => Promise<void>;
  saveSpecimenDate: (parameters: SpecimenDateChangedParameters) => Promise<void>;
}

export const usePatientLabOrders = <SearchBy extends LabOrdersSearchBy>(
  // don't use this directly, use memoized searchBy instead,
  // if parent component is re-rendered, _searchBy will be a new object and will trigger unnecessary effects
  _searchBy: SearchBy
): UsePatientLabOrdersResult<SearchBy> => {
  const { oystehrZambda } = useApiClients();
  const [labOrders, setLabOrders] = useState<LabOrderDTO<SearchBy>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [showPagination, setShowPagination] = useState(false);
  const [orderableItemCodeFilter, setOrderableItemCodeFilter] = useState('');
  const [visitDateFilter, setVisitDateFilter] = useState<DateTime | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const searchBy = useMemo(() => _searchBy, [JSON.stringify(_searchBy)]);

  const formatVisitDate = useCallback((date: DateTime | null): string | undefined => {
    if (!date || !date.isValid) {
      return undefined;
    }
    try {
      return date.toISODate() || undefined;
    } catch (dateError) {
      console.error('Error formatting date:', dateError);
    }
    return;
  }, []);

  const getCurrentSearchParamsWithoutPageIndex = useCallback((): GetLabOrdersParameters => {
    const params: GetLabOrdersParameters = {
      itemsPerPage: DEFAULT_LABS_ITEMS_PER_PAGE,
      ...searchBy,
      ...(orderableItemCodeFilter && { orderableItemCode: orderableItemCodeFilter }),
      ...(visitDateFilter && visitDateFilter.isValid && { visitDate: formatVisitDate(visitDateFilter) }),
    };

    return params;
  }, [orderableItemCodeFilter, visitDateFilter, formatVisitDate, searchBy]);

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
          setLabOrders(response.data as LabOrderDTO<SearchBy>[]);

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
    if (searchParams.searchBy.field && searchParams.searchBy.value) {
      void fetchLabOrders(searchParams);
    } else {
      console.error('searchParams are not valid', searchParams);
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

  const handleDeleteLabOrder = useCallback(
    async ({ serviceRequestId }: DeleteLabOrderParams): Promise<boolean> => {
      if (!serviceRequestId) {
        console.error('Cannot delete lab order: Missing service request ID');
        setError(new Error('Missing service request ID'));
        return false;
      }

      if (!oystehrZambda) {
        console.error('Cannot delete lab order: API client is not available');
        setError(new Error('API client is not available'));
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        const deleteParams: DeleteLabOrderParams = {
          serviceRequestId,
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
    [fetchLabOrders, getCurrentSearchParamsForPage, oystehrZambda]
  );

  // handle delete dialog
  const { showDeleteLabOrderDialog, DeleteOrderDialog } = useDeleteLabOrderDialog({
    deleteOrder: handleDeleteLabOrder,
  });

  const markTaskAsReviewed = useCallback(
    async ({ taskId, serviceRequestId, diagnosticReportId }: TaskReviewedParameters): Promise<void> => {
      if (!oystehrZambda) {
        console.error('oystehrZambda is not defined');
        return;
      }

      setLoading(true);

      await updateLabOrderResources(oystehrZambda, { taskId, serviceRequestId, diagnosticReportId, event: 'reviewed' });
      await fetchLabOrders(getCurrentSearchParamsForPage(1));
    },
    [oystehrZambda, fetchLabOrders, getCurrentSearchParamsForPage]
  );

  const saveSpecimenDate = useCallback(
    async ({
      specimenId,
      date,
      serviceRequestId,
    }: {
      specimenId: string;
      date: string;
      serviceRequestId: string;
    }): Promise<void> => {
      if (!oystehrZambda) {
        console.error('oystehrZambda is not defined');
        return;
      }

      await updateLabOrderResources(oystehrZambda, {
        specimenId,
        date,
        event: 'specimenDateChanged',
        serviceRequestId,
      });
    },
    [oystehrZambda]
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
    deleteLabOrder: handleDeleteLabOrder,
    showDeleteLabOrderDialog,
    DeleteOrderDialog,
    getCurrentSearchParams: getCurrentSearchParamsWithoutPageIndex,
    markTaskAsReviewed,
    saveSpecimenDate,
  };
};
