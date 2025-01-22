import { useMemo } from 'react';
import { ChartDataFieldsKeys, SearchParams } from 'utils';
import useEvolveUser from '../../../../../hooks/useEvolveUser';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore, useGetAppointmentAccessibility } from '../../../../../telemed';
import { useZapEHRAPIClient } from '../../../../../telemed/hooks/useOystehrAPIClient';
import { ChartDataCacheKey } from '../../../../../telemed/state/appointment/appointment.queries';

export const useChartDataCacheKey = (fieldName: ChartDataFieldsKeys, searchParams: SearchParams): ChartDataCacheKey => {
  const encounterId = useAppointmentStore((state) => state.encounter?.id);
  const apiClient = useZapEHRAPIClient();
  const user = useEvolveUser();
  const { isAppointmentLoading } = getSelectors(useAppointmentStore, ['isAppointmentLoading']);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const cacheKey: ChartDataCacheKey = useMemo(() => {
    const requestedFields = searchParams ? { [fieldName]: searchParams } : undefined;

    return ['telemed-get-chart-data', apiClient, encounterId, user, isReadOnly, isAppointmentLoading, requestedFields];
  }, [apiClient, fieldName, searchParams, encounterId, isAppointmentLoading, isReadOnly, user]);

  return cacheKey;
};
