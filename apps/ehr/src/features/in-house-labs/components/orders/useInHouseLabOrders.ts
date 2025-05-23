import { useCallback, useState, useEffect, useMemo } from 'react';
import {
  GetInHouseOrdersParameters,
  InHouseOrdersSearchBy,
  InHouseOrderDTO,
  PaginatedInHouseOrderResponse,
} from 'utils/lib/types/data/in-house/in-house.types';
import { useApiClients } from '../../../../hooks/useAppClients';
import { getInHouseOrders } from '../../../../api/api';
import { DateTime } from 'luxon';
import { DEFAULT_LABS_ITEMS_PER_PAGE } from 'utils';

export interface UseInHouseLabOrdersResult<SearchBy extends InHouseOrdersSearchBy> {
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
}

export const useInHouseLabOrders = <SearchBy extends InHouseOrdersSearchBy>(
  searchBy: SearchBy
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

  // Memoize searchBy to prevent unnecessary re-renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedSearchBy = useMemo(() => searchBy, [JSON.stringify(searchBy)]);

  const formatVisitDate = useCallback((date: DateTime | null): string | undefined => {
    if (!date || !date.isValid) {
      return undefined;
    }
    try {
      return date.toISODate() || undefined;
    } catch (dateError) {
      console.error('Error formatting date:', dateError);
      return undefined;
    }
  }, []);

  const getCurrentSearchParamsWithoutPageIndex = useCallback((): GetInHouseOrdersParameters => {
    const params: GetInHouseOrdersParameters = {
      itemsPerPage: DEFAULT_LABS_ITEMS_PER_PAGE,
      ...memoizedSearchBy,
      ...(testTypeFilter && { orderableItemCode: testTypeFilter }),
      ...(visitDateFilter && visitDateFilter.isValid && { visitDate: formatVisitDate(visitDateFilter) }),
    };

    return params;
  }, [testTypeFilter, visitDateFilter, formatVisitDate, memoizedSearchBy]);

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
        const response: PaginatedInHouseOrderResponse<GetInHouseOrdersParameters> = await getInHouseOrders(
          oystehrZambda,
          searchParams
        );

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

  // Initial fetch and when search criteria change
  useEffect(() => {
    const searchParams = getCurrentSearchParamsForPage(1);
    if (searchParams.searchBy.field && searchParams.searchBy.value) {
      // Reset page to 1 when search criteria change
      if (page !== 1) {
        setPage(1);
      } else {
        void fetchLabOrders(searchParams);
      }
    } else {
      setError(new Error('Missing required search parameters'));
      setLoading(false);
    }
  }, [memoizedSearchBy, testTypeFilter, visitDateFilter, getCurrentSearchParamsForPage, page, fetchLabOrders]);

  // Fetch when page changes (but not on initial load)
  useEffect(() => {
    const hasInitiallyLoaded = labOrders.length > 0 || !loading;
    if (hasInitiallyLoaded && page > 1) {
      const searchParams = getCurrentSearchParamsForPage(page);
      void fetchLabOrders(searchParams);
    }
  }, [page, fetchLabOrders, getCurrentSearchParamsForPage, labOrders.length, loading]);

  // Reset page when filters change
  useEffect(() => {
    if (page !== 1) {
      setPage(1);
    }
  }, [page, testTypeFilter, visitDateFilter]);

  const hasData = useMemo(() => labOrders.length > 0, [labOrders.length]);

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
  };
};
