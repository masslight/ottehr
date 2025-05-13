import { useCallback, useState, useEffect, useMemo } from 'react';
import {
  EMPTY_PAGINATION,
  DEFAULT_LABS_ITEMS_PER_PAGE,
  GetLabOrdersParameters,
  LabOrdersSearchBy,
} from 'utils/lib/types/data/labs';
import { useApiClients } from '../../../../hooks/useAppClients';
import { getLabOrders } from '../../../../api/api';
import { DateTime } from 'luxon';

// interface UseInHouseLabOrdersResult<SearchBy extends LabOrdersSearchBy> {
// interface UseInHouseLabOrdersResult {
//   labOrders: any; // todo: use actual type
//   loading: boolean;
//   error: Error | null;
//   totalPages: number;
//   page: number;
//   setPage: (page: number) => void;
//   testTypeFilter: string;
//   setTestTypeFilter: (filter: string) => void;
//   visitDateFilter: DateTime | null;
//   setVisitDateFilter: (date: DateTime | null) => void;
//   fetchLabOrders: (params: GetLabOrdersParameters) => Promise<void>;
//   showPagination: boolean;
// }

export const useInHouseLabOrders = <SearchBy extends LabOrdersSearchBy>(
  _searchBy: SearchBy
  // ): UseInHouseLabOrdersResult<SearchBy> => {
): any => {
  // totdo: use UseInHouseLabOrdersResult<SearchBy> for return type
  const { oystehrZambda } = useApiClients();
  const [labOrders, setLabOrders] = useState<any[]>([]); // todo: use LabOrderDTO<SearchBy>[]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [showPagination, setShowPagination] = useState(false);
  const [testTypeFilter, setTestTypeFilter] = useState('');
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
      ...(testTypeFilter && { orderableItemCode: testTypeFilter }),
      ...(visitDateFilter && visitDateFilter.isValid && { visitDate: formatVisitDate(visitDateFilter) }),
    };

    return params;
  }, [testTypeFilter, visitDateFilter, formatVisitDate, searchBy]);

  const getCurrentSearchParamsForPage = useCallback(
    (pageNumber: number): GetLabOrdersParameters => {
      if (pageNumber < 1) {
        throw Error('Page number must be greater than 0');
      }
      return { ...getCurrentSearchParamsWithoutPageIndex(), pageIndex: pageNumber - 1 };
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
        // In a real implementation, you would fetch in-house labs with a different API
        // For this example, we'll use the same getLabOrders function but add a parameter
        // to indicate we want in-house labs specifically
        const inHouseParams = {
          ...searchParams,
          labType: 'in-house', // This would be used on the backend to filter for in-house labs
        };

        let response;
        try {
          response = await getLabOrders(oystehrZambda, inHouseParams);
        } catch (err) {
          response = {
            data: [],
            pagination: EMPTY_PAGINATION,
          };
          console.error('Error fetching in-house lab orders:', err);
          setError(err instanceof Error ? err : new Error('Unknown error occurred'));
        }

        if (response?.data) {
          setLabOrders(response.data as any[]); // todo: use LabOrderDTO<SearchBy>[]

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
        console.error('error with setting in-house lab orders:', error);
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

  // Initial fetch of lab orders, and when the search params change
  useEffect(() => {
    const searchParams = getCurrentSearchParamsForPage(1);
    if (searchParams.searchBy.field && searchParams.searchBy.value) {
      void fetchLabOrders(searchParams);
    } else {
      console.error('searchParams are not valid', searchParams);
    }
  }, [fetchLabOrders, getCurrentSearchParamsForPage, testTypeFilter, visitDateFilter]);

  // Fetch lab orders when the page changes
  useEffect(() => {
    const didOrdersFetch = labOrders.length > 0;
    if (didOrdersFetch && page > 1) {
      const searchParams = getCurrentSearchParamsForPage(page);
      void fetchLabOrders(searchParams);
    }
  }, [fetchLabOrders, getCurrentSearchParamsForPage, labOrders.length, page]);

  // For demonstration, we'll create mock data similar to the screenshot
  useEffect(() => {
    if (import.meta.env.DEV && labOrders.length === 0 && !loading) {
      // Only in development and when no real data is available
      const mockData = [
        {
          serviceRequestId: '123',
          testItem: 'Rapid Strep A',
          visitDate: '2025-05-27T10:17:00.000Z',
          orderAddedDate: '2025-05-27T10:17:00.000Z',
          orderingPhysician: 'Dr. Smith',
          diagnosesDTO: [{ code: 'J02.0', display: 'Streptococcal pharyngitis' }],
          diagnoses: 'J02.0 Streptococcal pharyngitis',
          orderStatus: 'collected',
          lastResultReceivedDate: '2025-05-27T10:17:00.000Z',
          encounterTimezone: 'America/New_York',
          appointmentId: '111',
          reflexResultsCount: 0,
          accessionNumbers: ['123456'],
          isPSC: false,
        },
        {
          serviceRequestId: '456',
          testItem: 'COVID-19 Antigen',
          visitDate: '2025-05-27T10:17:00.000Z',
          orderAddedDate: '2025-05-27T10:17:00.000Z',
          orderingPhysician: 'Dr. Smith',
          diagnosesDTO: [{ code: 'B19.9', display: 'Unspecified viral hepatitis' }],
          diagnoses: 'B19.9 Unspecified viral hepatitis',
          orderStatus: 'final',
          lastResultReceivedDate: '2025-05-27T10:17:00.000Z',
          encounterTimezone: 'America/New_York',
          appointmentId: '222',
          reflexResultsCount: 0,
          accessionNumbers: ['789012'],
          isPSC: false,
        },
      ] as any[]; // todo: use LabOrderDTO<SearchBy>[]

      setLabOrders(mockData);
      setTotalPages(10); // For pagination demonstration
      setShowPagination(true);
    }
  }, [labOrders.length, loading]);

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
  };
};
