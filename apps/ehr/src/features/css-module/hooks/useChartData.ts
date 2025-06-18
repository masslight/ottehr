import { useEffect } from 'react';
import { QueryKey, QueryObserverResult } from 'react-query';
import { ChartDataRequestedFields, GetChartDataResponse } from 'utils';
import { useAppointmentStore, useGetChartData } from '../../../telemed';
import { useExamObservations } from '../../../telemed/hooks/useExamObservations';
import { useZapEHRAPIClient } from '../../../telemed/hooks/useOystehrAPIClient';

export const useChartData = ({
  encounterId,
  requestedFields,
  shouldUpdateExams,
  onSuccess,
  onError,
  enabled = true,
  replaceStoreValues = false,
  refetchInterval,
}: {
  encounterId: string;
  requestedFields?: ChartDataRequestedFields;
  shouldUpdateExams?: boolean;
  onSuccess?: (response: GetChartDataResponse) => void;
  onError?: (error: any) => void;
  enabled?: boolean;
  replaceStoreValues?: boolean;
  refetchInterval?: number;
}): {
  refetch: () => Promise<QueryObserverResult<GetChartDataResponse, unknown>>;
  chartData: GetChartDataResponse | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: any;
  queryKey: QueryKey;
  isFetched: boolean;
} => {
  const apiClient = useZapEHRAPIClient();
  const { update: updateExamObservations } = useExamObservations();
  const setPartialChartData = useAppointmentStore((state) => state.setPartialChartData);

  const {
    error: chartDataError,
    isLoading,
    isFetching,
    refetch,
    data: chartData,
    queryKey,
    isFetched,
  } = useGetChartData(
    { apiClient, encounterId, requestedFields, enabled, refetchInterval },
    (data) => {
      onSuccess?.(data);
      if (replaceStoreValues) {
        Object.keys(requestedFields || {}).forEach((field) => {
          setPartialChartData({ [field]: data[field as keyof GetChartDataResponse] });
        });
      }

      if (!requestedFields) {
        useAppointmentStore.setState({
          isChartDataLoading: false,
        });
      }

      // not set state for custom fields request, because data will be incomplete
      if (requestedFields) return;

      // should be updated only from root (useAppointment hook)
      shouldUpdateExams && updateExamObservations(data.examObservations, true);
    },
    (error) => {
      if (!requestedFields) {
        useAppointmentStore.setState({
          isChartDataLoading: false,
        });
      }
      onError?.(error);
    }
  );

  useEffect(() => {
    if (!requestedFields && enabled) {
      useAppointmentStore.setState({
        isChartDataLoading: isFetching,
      });
    }
  }, [chartData, isFetching, requestedFields, enabled]);

  return { refetch, chartData, isLoading, error: chartDataError, queryKey, isFetching, isFetched };
};
