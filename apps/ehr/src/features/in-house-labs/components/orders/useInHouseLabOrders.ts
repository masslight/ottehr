import { useCallback, useState, useEffect, useMemo, ReactNode, useRef } from 'react';
import { DateTime } from 'luxon';
import { DEFAULT_IN_HOUSE_LABS_ITEMS_PER_PAGE, tryFormatDateToISO } from 'utils';
import { useDeleteCommonLabOrderDialog } from 'src/features/common/useDeleteCommonLabOrderDialog';
import {
  GetInHouseOrdersParameters,
  InHouseOrdersSearchBy,
  InHouseOrderDTO,
  DeleteInHouseLabOrderParameters,
} from 'utils/lib/types/data/in-house/in-house.types';
import { useApiClients } from '../../../../hooks/useAppClients';
import { deleteInHouseLabOrder, getInHouseOrders } from '../../../../api/api';

interface UseInHouseLabOrdersResult<SearchBy extends InHouseOrdersSearchBy> {
  labOrders: InHouseOrderDTO<SearchBy>[];
  loading: boolean;
  error: Error | null;
  totalPages: number;
  page: number;
  setPage: (page: number) => void;
  testTypeFilter: string;
  setTestTypeFilter: (filter: string) => void;
  visitDateFilter: DateTime | null;
  setVisitDateFilter: (date: DateTime | null) => void;
  fetchLabOrders: (searchParams: GetInHouseOrdersParameters) => Promise<void>;
  showPagination: boolean;
  refetch: () => void;
  hasData: boolean;
  totalItems: number;
  showDeleteLabOrderDialog: ({
    serviceRequestId,
    testItemName,
  }: {
    serviceRequestId: string;
    testItemName: string;
  }) => void;
  DeleteOrderDialog: ReactNode | null;
}

export const useInHouseLabOrders = <SearchBy extends InHouseOrdersSearchBy>(
  _searchBy: SearchBy
): UseInHouseLabOrdersResult<SearchBy> => {
  const { oystehrZambda } = useApiClients();
  const [labOrders, setLabOrders] = useState<InHouseOrderDTO<SearchBy>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [showPagination, setShowPagination] = useState(false);
  const [testTypeFilter, setTestTypeFilter] = useState('');
  const [visitDateFilter, setVisitDateFilter] = useState<DateTime | null>(null);
  const didOrdersFetchRef = useRef(false);

  // Memoize searchBy to prevent unnecessary re-renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedSearchBy = useMemo(() => _searchBy, [JSON.stringify(_searchBy)]);

  const getCurrentSearchParamsWithoutPageIndex = useCallback((): GetInHouseOrdersParameters => {
    const params: GetInHouseOrdersParameters = {
      itemsPerPage: DEFAULT_IN_HOUSE_LABS_ITEMS_PER_PAGE,
      ...memoizedSearchBy,
      ...(testTypeFilter && { orderableItemCode: testTypeFilter }),
      ...(visitDateFilter && visitDateFilter.isValid && { visitDate: tryFormatDateToISO(visitDateFilter) }),
    };

    return params;
  }, [testTypeFilter, visitDateFilter, memoizedSearchBy]);

  const getCurrentSearchParamsForPage = useCallback(
    (pageNumber: number): GetInHouseOrdersParameters => {
      if (pageNumber < 1) {
        throw new Error('Page number must be greater than 0');
      }
      return { ...getCurrentSearchParamsWithoutPageIndex(), pageIndex: pageNumber - 1 };
    },
    [getCurrentSearchParamsWithoutPageIndex]
  );

  const fetchLabOrders = useCallback(
    async (searchParams: GetInHouseOrdersParameters): Promise<void> => {
      if (!oystehrZambda) {
        console.error('oystehrZambda is not defined');
        setError(new Error('API client not available'));
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await getInHouseOrders(oystehrZambda, searchParams);

        if (response?.data) {
          setLabOrders(response.data as InHouseOrderDTO<SearchBy>[]);
          setTotalItems(response.pagination?.totalItems || 0);

          if (response.pagination) {
            setTotalPages(response.pagination.totalPages || 1);
            setShowPagination(response.pagination.totalPages > 1);
          } else {
            setTotalPages(1);
            setShowPagination(false);
          }
        } else {
          setLabOrders([]);
          setTotalItems(0);
          setTotalPages(1);
          setShowPagination(false);
        }
      } catch (fetchError) {
        const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error occurred';
        setError(new Error(`Failed to fetch in-house lab orders: ${errorMessage}`));

        // Reset state on error
        setLabOrders([]);
        setTotalItems(0);
        setTotalPages(1);
        setShowPagination(false);
      } finally {
        setLoading(false);
      }
    },
    [oystehrZambda]
  );

  // Refetch function for manual refresh
  const refetch = useCallback(() => {
    const searchParams = getCurrentSearchParamsForPage(page);
    if (searchParams.searchBy.field && searchParams.searchBy.value) {
      void fetchLabOrders(searchParams);
    } else {
      console.error('Invalid search parameters for refetch:', searchParams);
      setError(new Error('Invalid search parameters'));
    }
  }, [fetchLabOrders, getCurrentSearchParamsForPage, page]);

  // initial fetch of lab orders, and when the search params change
  useEffect(() => {
    const searchParams = getCurrentSearchParamsForPage(1);
    if (searchParams.searchBy.field && searchParams.searchBy.value) {
      void fetchLabOrders(searchParams);
    } else {
      console.error('searchParams are not valid', searchParams);
    }
  }, [fetchLabOrders, getCurrentSearchParamsForPage]);

  // React.ref handles edge case when table items exceed actual display data
  // (errors during parsing where the table has fewer items than the Oystehr API
  // returns for ServiceRequests), ensuring users can navigate away from empty pages.
  didOrdersFetchRef.current =
    labOrders.length > 0 && didOrdersFetchRef.current === false ? true : didOrdersFetchRef.current;

  // fetch lab orders when the page changes
  useEffect(() => {
    // skip if the orders haven't been fetched yet, to prevent fetching when the page is first loaded
    if (didOrdersFetchRef.current) {
      const searchParams = getCurrentSearchParamsForPage(page);
      void fetchLabOrders(searchParams);
    }
  }, [fetchLabOrders, getCurrentSearchParamsForPage, page]);

  const hasData = useMemo(() => labOrders.length > 0, [labOrders.length]);

  const handleDeleteLabOrder = useCallback(
    async ({ serviceRequestId }: DeleteInHouseLabOrderParameters): Promise<boolean> => {
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
        await deleteInHouseLabOrder(oystehrZambda, {
          serviceRequestId,
        });

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
  const { showDeleteLabOrderDialog, DeleteOrderDialog } = useDeleteCommonLabOrderDialog({
    deleteOrder: handleDeleteLabOrder,
  });

  return {
    labOrders,
    loading,
    error,
    totalPages,
    totalItems,
    page,
    setPage,
    testTypeFilter,
    setTestTypeFilter,
    visitDateFilter,
    setVisitDateFilter,
    fetchLabOrders,
    showPagination,
    refetch,
    hasData,
    showDeleteLabOrderDialog,
    DeleteOrderDialog,
  };
};
