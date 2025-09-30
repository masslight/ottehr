import { useMemo } from 'react';
import { CHART_DATA_QUERY_KEY_BASE } from 'src/constants';
import { ChartDataCacheKey, useAppointmentData } from 'src/shared/hooks/appointment/appointment.store';
import { AllChartValuesKeys, SearchParams } from 'utils';

export const useChartDataCacheKey = (fieldName: AllChartValuesKeys, searchParams: SearchParams): ChartDataCacheKey => {
  const { encounter } = useAppointmentData();
  const cacheKey: ChartDataCacheKey = useMemo(() => {
    const requestedFields = searchParams ? { [fieldName]: searchParams } : undefined;
    return [CHART_DATA_QUERY_KEY_BASE, encounter?.id, requestedFields];
  }, [fieldName, searchParams, encounter?.id]);

  return cacheKey;
};
