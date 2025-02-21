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
}: {
  encounterId: string;
  requestedFields?: ChartDataRequestedFields;
  shouldUpdateExams?: boolean;
  onSuccess?: (response: GetChartDataResponse) => void;
  onError?: (error: any) => void;
  enabled?: boolean;
  replaceStoreValues?: boolean;
}): {
  refetch: () => Promise<QueryObserverResult<GetChartDataResponse, unknown>>;
  chartData: GetChartDataResponse | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: any;
  queryKey: QueryKey;
} => {
  const apiClient = useZapEHRAPIClient();
  const { update } = useExamObservations();
  const setPartialChartData = useAppointmentStore((state) => state.setPartialChartData);

  const {
    error: chartDataError,
    isLoading,
    isFetching,
    refetch,
    data: chartData,
    queryKey,
  } = useGetChartData(
    { apiClient, encounterId, requestedFields, enabled },
    (data) => {
      onSuccess?.(data);
      if (replaceStoreValues) {
        Object.keys(requestedFields || {}).forEach((field) => {
          setPartialChartData({ [field]: data[field as keyof GetChartDataResponse] });
        });
      }

      // not set state for custom fileds request, because data will be incompleted
      if (requestedFields) return;

      // should be updated only from root (useAppointment hook)
      shouldUpdateExams && update(data.examObservations, true);
    },
    onError
  );

  return { refetch, chartData, isLoading, error: chartDataError, queryKey, isFetching };
};
