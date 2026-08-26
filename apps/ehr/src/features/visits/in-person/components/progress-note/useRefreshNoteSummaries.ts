import { QueryKey, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { CHART_FIELDS_QUERY_KEY } from 'src/constants';
import { useAppointmentData, useChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';

interface UseRefreshNoteSummariesOptions {
  /** Extra caches a section's summary reads from, e.g. the immunization orders list. */
  extraQueryKeys?: QueryKey[];
}

/**
 * Invalidates both chart caches so the note summaries pick up an order placed from a section.
 * `useChartData` and `useChartFields` are separate queries under separate keys, and the
 * chart-fields observer stays mounted while a section is open, so it only refetches when
 * invalidated explicitly.
 */
export const useRefreshNoteSummaries = (options?: UseRefreshNoteSummariesOptions): (() => void) => {
  const { encounter } = useAppointmentData();
  const encounterId = encounter?.id;
  const { refetch } = useChartData();
  const queryClient = useQueryClient();
  const extraQueryKeys = options?.extraQueryKeys;

  // Read through a ref so the returned callback is stable and the unmount effect never re-runs.
  const refreshRef = useRef<() => void>(() => undefined);
  refreshRef.current = () => {
    void refetch();
    void queryClient.invalidateQueries({ queryKey: [CHART_FIELDS_QUERY_KEY, encounterId], exact: false });
    extraQueryKeys?.forEach((queryKey) => void queryClient.invalidateQueries({ queryKey, exact: false }));
  };

  useEffect(() => {
    return () => refreshRef.current();
  }, []);

  return useCallback(() => refreshRef.current(), []);
};
