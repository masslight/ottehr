import { DateTime } from 'luxon';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FEATURE_FLAGS } from 'src/constants/feature-flags';
import { useDeleteCommonLabOrderDialog } from 'src/features/common/useDeleteCommonLabOrderDialog';
import { DEFAULT_IN_HOUSE_LABS_ITEMS_PER_PAGE, tryFormatDateToISO } from 'utils';
import {
  DeleteInHouseLabOrderParameters,
  GetInHouseOrdersParameters,
  InHouseGetOrdersResponseDTO,
  InHouseOrderListPageItemDTO,
  InHouseOrdersSearchBy,
} from 'utils/lib/types/data/in-house/in-house.types';
import { deleteInHouseLabOrder, getInHouseOrders } from '../../../../api/api';
import { useApiClients } from '../../../../hooks/useAppClients';

interface UseInHouseLabOrdersResult {
  labOrders: InHouseOrderListPageItemDTO[];
  loading: boolean;
  error: Error | null;
  totalPages: number;
  page: number;
  testTypeFilter: string;
  visitDateFilter: DateTime | null;
  setSearchParams: (searchParams: {
    pageNumber?: number;
    testTypeFilter?: string;
    visitDateFilter?: DateTime | null;
  }) => void;
  showPagination: boolean;
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
): UseInHouseLabOrdersResult => {
  const { oystehrZambda } = useApiClients();
  const [labOrders, setLabOrders] = useState<InHouseGetOrdersResponseDTO<SearchBy>['data']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  /**
   * Search state management strategy:
   *
   * Page: object in useState to force useEffect re-runs even with same value
   * Filters: refs to avoid re-renders when setting multiple filters and to get updated values synchronously
   *
   * Benefits:
   * - Single useEffect handles all search logic (page + searchBy dependencies)
   * - Filters can be set independently without triggering fetches
   * - Page changes are the only fetch trigger (predictable data flow)
   * - Simplified API: one setSearchParams method for everything
   */
  const [page, setPage] = useState({ pageNumber: 1 });
  const testTypeFilterRef = useRef('');
  const visitDateFilterRef = useRef<DateTime | null>(null);

  const [showPagination, setShowPagination] = useState(false);

  // calling without arguments will refetch the data with the current search params
  const setSearchParams = useCallback(
    (searchParams: { pageNumber?: number; testTypeFilter?: string; visitDateFilter?: DateTime | null }) => {
      searchParams.testTypeFilter !== undefined && (testTypeFilterRef.current = searchParams.testTypeFilter);
      searchParams.visitDateFilter !== undefined && (visitDateFilterRef.current = searchParams.visitDateFilter);
      setPage((page) => ({ pageNumber: searchParams.pageNumber || page.pageNumber }));
    },
    []
  );

  // Memoize searchBy to prevent unnecessary re-renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedSearchBy = useMemo(() => _searchBy, [JSON.stringify(_searchBy)]);

  const fetchLabOrders = useCallback(
    async (searchParams: GetInHouseOrdersParameters): Promise<void> => {
      if (FEATURE_FLAGS.IN_HOUSE_LABS_ENABLED !== true) {
        return;
      }

      if (!oystehrZambda) {
        console.error('oystehrZambda is not defined');
        setError(new Error('API client not available'));
        return;
      }

      if (
        !searchParams.searchBy.value ||
        (Array.isArray(searchParams.searchBy.value) && searchParams.searchBy.value.length === 0)
      ) {
        // search params are not ready yet, that's ok probably
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await getInHouseOrders(oystehrZambda, searchParams);

        if (response?.data) {
          setLabOrders(response.data);
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

  useEffect(() => {
    if (page.pageNumber < 1) {
      throw new Error('Page number must be greater than 0');
    }

    const params: GetInHouseOrdersParameters = {
      itemsPerPage: DEFAULT_IN_HOUSE_LABS_ITEMS_PER_PAGE,
      ...memoizedSearchBy,
      ...(testTypeFilterRef.current && { orderableItemCode: testTypeFilterRef.current }),
      ...(visitDateFilterRef.current &&
        visitDateFilterRef.current.isValid && { visitDate: tryFormatDateToISO(visitDateFilterRef.current) }),
    };

    const searchParams = { ...params, pageIndex: page.pageNumber - 1 };

    if (searchParams.searchBy.field && searchParams.searchBy.value) {
      void fetchLabOrders(searchParams);
    } else {
      console.error('searchParams are not valid', searchParams);
    }
  }, [fetchLabOrders, page, memoizedSearchBy]);

  const hasData = labOrders.length > 0;

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

        setSearchParams({ pageNumber: 1 });

        return true;
      } catch (err) {
        console.error('Error deleting In-house Lab Order:', err);

        const errorObj =
          err instanceof Error ? err : new Error(typeof err === 'string' ? err : 'Failed to delete lab order');

        setError(errorObj);

        return false;
      } finally {
        setLoading(false);
      }
    },
    [oystehrZambda, setSearchParams]
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
    page: page.pageNumber,
    setSearchParams,
    showPagination,
    hasData,
    showDeleteLabOrderDialog,
    DeleteOrderDialog,
    testTypeFilter: testTypeFilterRef.current,
    visitDateFilter: visitDateFilterRef.current,
  };
};
