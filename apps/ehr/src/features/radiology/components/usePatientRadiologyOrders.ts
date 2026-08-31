import Oystehr from '@oystehr/sdk';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import {
  CancelRadiologyOrderZambdaInput,
  GetRadiologyOrderListZambdaInput,
  GetRadiologyOrderListZambdaOrder,
  RadiologyReportType,
} from 'utils/lib/types/api/radiology';
import { EMPTY_PAGINATION } from 'utils/lib/types/data/labs/labs.constants';
import {
  cancelRadiologyOrder,
  getRadiologyOrders,
  saveFinalReport,
  savePreliminaryReport,
  sendForFinalRead,
  updateRadiologyOrder,
  updateRadiologyReport,
} from '../../../api/api';
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
  handleSaveReport: (
    serviceRequestId: string,
    report: string,
    reportType: RadiologyReportType,
    diagnosisCodes?: string[],
    performedById?: string
  ) => Promise<void>;
  /** Corrects a read that was already saved. Resolves `true` only when the edit was persisted. */
  handleUpdateReport: (serviceRequestId: string, report: string, reportType: RadiologyReportType) => Promise<boolean>;
  /** Records who performed the study, on its own. Resolves `true` only when it was persisted. */
  handleSavePerformedBy: (serviceRequestId: string, performedById: string) => Promise<boolean>;
  handleSendForFinalRead: (serviceRequestId: string) => Promise<void>;
  handleUpdateConsent: (serviceRequestId: string, consentObtained: boolean) => Promise<void>;
  isSavingReport: boolean;
  isSavingPerformedBy: boolean;
  isSendingForFinalRead: boolean;
  isUpdatingConsent: boolean;
}

export const usePatientRadiologyOrders = (options: {
  patientId?: string;
  encounterIds?: string | string[];
  serviceRequestId?: string;
  refreshKey?: number;
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
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [isSavingPerformedBy, setIsSavingPerformedBy] = useState(false);
  const [isSendingForFinalRead, setIsSendingForFinalRead] = useState(false);
  const [isUpdatingConsent, setIsUpdatingConsent] = useState(false);

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
  }, [fetchOrders, getCurrentSearchParamsForPage, options?.refreshKey]);

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

  /**
   * The shape every order mutation shares: call the zambda, then refetch so the page reflects the write.
   * On failure it surfaces the API's own message (falling back to `defaultError`) and leaves the list alone.
   * Resolves true only when the write landed, so callers can keep an edit field open on failure.
   */
  const runOrderAction = useCallback(
    async ({
      call,
      setBusy,
      defaultError,
    }: {
      call: (client: Oystehr) => Promise<unknown>;
      setBusy?: (busy: boolean) => void;
      defaultError: string;
    }): Promise<boolean> => {
      if (!oystehrZambda) {
        console.error(`${defaultError}: API client is not available`);
        setError(new Error('API client is not available'));
        return false;
      }

      setBusy?.(true);
      setError(null);

      try {
        await call(oystehrZambda);
        await fetchOrders(getCurrentSearchParamsForPage(page));
        return true;
      } catch (err) {
        console.error(defaultError, err);
        const errorMsg = getApiError({ error: err, defaultError });
        setError(err instanceof Error ? err : new Error(errorMsg));
        enqueueSnackbar(errorMsg, { variant: 'error' });
        return false;
      } finally {
        setBusy?.(false);
      }
    },
    [fetchOrders, getCurrentSearchParamsForPage, oystehrZambda, page]
  );

  const handleSaveReport = useCallback(
    async (
      serviceRequestId: string,
      report: string,
      reportType: RadiologyReportType,
      diagnosisCodes?: string[],
      performedById?: string
    ): Promise<void> => {
      if (!report) {
        enqueueSnackbar(`Please enter a ${reportType} report before saving.`, { variant: 'error' });
        return;
      }

      await runOrderAction({
        call: (client) =>
          reportType === 'preliminary'
            ? // Diagnosis is captured with the preliminary read (it is optional at order time).
              savePreliminaryReport(client, { serviceRequestId, report, diagnosisCodes, performedById })
            : saveFinalReport(client, { serviceRequestId, report }),
        setBusy: setIsSavingReport,
        defaultError: `Failed to save ${reportType} report`,
      });
    },
    [runOrderAction]
  );

  const handleUpdateReport = useCallback(
    async (serviceRequestId: string, report: string, reportType: RadiologyReportType): Promise<boolean> => {
      if (!report) {
        enqueueSnackbar(`Please enter a ${reportType} report before saving.`, { variant: 'error' });
        return false;
      }

      // No shared busy flag: the two reads can be edited at once, and each field tracks its own save.
      return runOrderAction({
        call: (client) => updateRadiologyReport(client, { serviceRequestId, report, reportType }),
        defaultError: `Failed to update ${reportType} report`,
      });
    },
    [runOrderAction]
  );

  const handleSavePerformedBy = useCallback(
    async (serviceRequestId: string, performedById: string): Promise<boolean> =>
      runOrderAction({
        call: (client) =>
          updateRadiologyOrder(client, { serviceRequestId, update: { type: 'performed-by', performedById } }),
        setBusy: setIsSavingPerformedBy,
        defaultError: 'Failed to save performed by',
      }),
    [runOrderAction]
  );

  const handleSendForFinalRead = useCallback(
    async (serviceRequestId: string): Promise<void> => {
      await runOrderAction({
        call: (client) => sendForFinalRead(client, { serviceRequestId }),
        setBusy: setIsSendingForFinalRead,
        defaultError: 'An error occurred while sending for final read',
      });
    },
    [runOrderAction]
  );

  const handleUpdateConsent = useCallback(
    async (serviceRequestId: string, consentObtained: boolean): Promise<void> => {
      await runOrderAction({
        call: (client) =>
          updateRadiologyOrder(client, { serviceRequestId, update: { type: 'consent', consentObtained } }),
        setBusy: setIsUpdatingConsent,
        defaultError: 'An error occurred while updating consent',
      });
    },
    [runOrderAction]
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
    handleSaveReport,
    handleUpdateReport,
    handleSavePerformedBy,
    handleSendForFinalRead,
    handleUpdateConsent,
    isSavingReport,
    isSavingPerformedBy,
    isSendingForFinalRead,
    isUpdatingConsent,
  };
};
