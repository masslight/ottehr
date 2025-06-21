import { useCallback, useState, ReactElement, useMemo, useRef, useEffect } from 'react';
import {
  EMPTY_PAGINATION,
  LabOrderDTO,
  DEFAULT_LABS_ITEMS_PER_PAGE,
  GetLabOrdersParameters,
  DeleteLabOrderZambdaInput,
  LabOrdersSearchBy,
  TaskReviewedParameters,
  SpecimenDateChangedParameters,
  tryFormatDateToISO,
  PatientLabItem,
  PaginatedResponse,
} from 'utils';
import { useApiClients } from '../../../../hooks/useAppClients';
import { getExternalLabOrders, deleteLabOrder, updateLabOrderResources } from '../../../../api/api';
import { DateTime } from 'luxon';
import { useDeleteCommonLabOrderDialog } from '../../../common/useDeleteCommonLabOrderDialog';
import { getExternalLabOrdersUrl } from 'src/features/css-module/routing/helpers';
import { useNavigate } from 'react-router-dom';

interface UsePatientLabOrdersResult<SearchBy extends LabOrdersSearchBy> {
  labOrders: LabOrderDTO<SearchBy>[];
  loading: boolean;
  error: Error | null;
  totalPages: number;
  page: number;
  setSearchParams: (searchParams: {
    pageNumber?: number;
    testTypeFilter?: string;
    visitDateFilter?: DateTime | null;
  }) => void;
  orderableItemCodeFilter: string;
  visitDateFilter: DateTime | null;
  fetchLabOrders: (params: GetLabOrdersParameters) => Promise<void>;
  showPagination: boolean;
  deleteLabOrder: (params: DeleteLabOrderZambdaInput) => Promise<boolean>;
  showDeleteLabOrderDialog: ({
    serviceRequestId,
    testItemName,
  }: {
    serviceRequestId: string;
    testItemName: string;
  }) => void;
  DeleteOrderDialog: ReactElement | null;
  markTaskAsReviewed: (parameters: TaskReviewedParameters & { appointmentId: string }) => Promise<void>;
  saveSpecimenDate: (parameters: SpecimenDateChangedParameters) => Promise<void>;
  patientLabItems: PatientLabItem[];
}

export const usePatientLabOrders = <SearchBy extends LabOrdersSearchBy>(
  _searchBy: SearchBy
): UsePatientLabOrdersResult<SearchBy> => {
  const { oystehrZambda } = useApiClients();
  const navigate = useNavigate();
  const [labOrders, setLabOrders] = useState<LabOrderDTO<SearchBy>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [patientLabItems, setPatientLabItems] = useState<PatientLabItem[]>([]);

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
    async (searchParams: GetLabOrdersParameters): Promise<void> => {
      if (!oystehrZambda) {
        console.error('oystehrZambda is not defined');
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
        let response: PaginatedResponse<SearchBy>;
        try {
          response = await getExternalLabOrders(oystehrZambda, searchParams);
        } catch (err) {
          response = {
            data: [],
            pagination: EMPTY_PAGINATION,
            patientLabItems: [],
          };
          console.error('Error fetching external lab orders:', err);
          setError(err instanceof Error ? err : new Error('Unknown error occurred'));
        }

        if (response?.data) {
          setLabOrders(response.data as LabOrderDTO<SearchBy>[]);
          setPatientLabItems(response.patientLabItems || []);

          if (response.pagination) {
            setTotalPages(response.pagination.totalPages || 1);
            setShowPagination(response.pagination.totalPages > 1);
          } else {
            setTotalPages(1);
            setShowPagination(false);
          }
        } else {
          setLabOrders([]);
          setPatientLabItems([]);
          setTotalPages(1);
          setShowPagination(false);
        }
      } catch (error) {
        console.error('error with setting external lab orders:', error);
        setError(error instanceof Error ? error : new Error('Unknown error occurred'));
        setLabOrders([]);
        setPatientLabItems([]);
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
      throw Error('Page number must be greater than 0');
    }

    const params: GetLabOrdersParameters = {
      itemsPerPage: DEFAULT_LABS_ITEMS_PER_PAGE,
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

  const handleDeleteLabOrder = useCallback(
    async ({ serviceRequestId }: DeleteLabOrderZambdaInput): Promise<boolean> => {
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
        const deleteParams: DeleteLabOrderZambdaInput = {
          serviceRequestId,
        };

        await deleteLabOrder(oystehrZambda, deleteParams);

        setSearchParams({ pageNumber: 1 });

        return true;
      } catch (err) {
        console.error('Error deleting external lab order:', err);

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

  const markTaskAsReviewed = useCallback(
    async ({
      taskId,
      serviceRequestId,
      diagnosticReportId,
      appointmentId,
    }: TaskReviewedParameters & { appointmentId: string }): Promise<void> => {
      if (!oystehrZambda) {
        console.error('oystehrZambda is not defined');
        return;
      }

      setLoading(true);

      await updateLabOrderResources(oystehrZambda, { taskId, serviceRequestId, diagnosticReportId, event: 'reviewed' });
      setSearchParams({ pageNumber: 1 });
      navigate(getExternalLabOrdersUrl(appointmentId));
    },
    [oystehrZambda, setSearchParams, navigate]
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
    page: page.pageNumber,
    setSearchParams,
    orderableItemCodeFilter: testTypeFilterRef.current,
    visitDateFilter: visitDateFilterRef.current,
    fetchLabOrders,
    showPagination,
    deleteLabOrder: handleDeleteLabOrder,
    showDeleteLabOrderDialog,
    DeleteOrderDialog,
    markTaskAsReviewed,
    saveSpecimenDate,
    patientLabItems,
  };
};
