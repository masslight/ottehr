import { QueryKey, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { invalidateChartFields } from 'src/features/visits/shared/hooks/useChartFields';
import { useAppointmentData, useChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { RequestedFields } from 'utils/lib/types/api/chart-data/chart-data.types';

interface UseRefreshNoteSummariesOptions {
  /**
   * Chart fields this section can change. Only the queries asking for one of them are
   * invalidated — the note page has a dozen chart-fields queries mounted, and refetching
   * all of them every time a section closes is a request storm for nothing.
   */
  fields?: RequestedFields[];
  /** Extra caches a section's summary reads from, e.g. the immunization orders list. */
  extraQueryKeys?: QueryKey[];
}

/**
 * Invalidates the caches a section's summary reads, so the note picks up an order placed
 * from that section. `useChartData` and `useChartFields` are separate queries under separate
 * keys, and an observer that stays mounted only refetches when invalidated explicitly.
 */
export const useRefreshNoteSummaries = (options?: UseRefreshNoteSummariesOptions): (() => void) => {
  const { encounter } = useAppointmentData();
  const encounterId = encounter?.id;
  const { refetch } = useChartData();
  const queryClient = useQueryClient();
  const { fields, extraQueryKeys } = options ?? {};

  // Read through a ref so the returned callback is stable and the unmount effect never re-runs.
  const refreshRef = useRef<() => void>(() => undefined);
  refreshRef.current = () => {
    void refetch();
    invalidateChartFields(queryClient, encounterId, fields ?? []);
    extraQueryKeys?.forEach((queryKey) => void queryClient.invalidateQueries({ queryKey, exact: false }));
  };

  useEffect(() => {
    return () => refreshRef.current();
  }, []);

  return useCallback(() => refreshRef.current(), []);
};
