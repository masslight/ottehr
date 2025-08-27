import { useMemo } from 'react';
import { ChartDataFieldsKeys, SearchParams } from 'utils';
// import useEvolveUser from '../../../../../hooks/useEvolveUser';
// import { getSelectors } from '../../../../../shared/store/getSelectors';
import {
  CHART_DATA_QUERY_KEY_BASE,
  ChartDataCacheKey,
  useAppointmentData,
  // useGetAppointmentAccessibility,
} from '../../../../../telemed';
// import { useOystehrAPIClient } from '../../../../../telemed/hooks/useOystehrAPIClient';

export const useChartDataCacheKey = (fieldName: ChartDataFieldsKeys, searchParams: SearchParams): ChartDataCacheKey => {
  const { encounter } = useAppointmentData();
  // const appointmentStore = useAppointmentWithOptimisticUpdates();
  // const apiClient = useOystehrAPIClient();
  // const user = useEvolveUser();
  // const { isAppointmentLoading } = getSelectors(appointmentStore, ['isAppointmentLoading']);
  // const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const cacheKey: ChartDataCacheKey = useMemo(() => {
    const requestedFields = searchParams ? { [fieldName]: searchParams } : undefined;

    // todo: check
    return [
      CHART_DATA_QUERY_KEY_BASE,
      //  apiClient,
      encounter?.id,
      //  user,
      //  isReadOnly,
      //  isAppointmentLoading,
      requestedFields,
    ];
  }, [fieldName, searchParams, encounter?.id]);

  return cacheKey;
};
