import { QueryKey, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { invalidateChart } from 'src/features/visits/shared/hooks/chartSectionCache';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';

interface UseRefreshNoteSummariesOptions {
  /** Extra caches a section's summary reads from, e.g. the immunization orders list. */
  extraQueryKeys?: QueryKey[];
}

/**
 * Re-reads the visit note when a section's inline flow closes, so the note picks up an order placed from
 * that section. The note is one read that re-seeds every section, so there is nothing to pick per field.
 */
export const useRefreshNoteSummaries = (options?: UseRefreshNoteSummariesOptions): (() => void) => {
  const { encounter } = useAppointmentData();
  const encounterId = encounter?.id;
  const queryClient = useQueryClient();
  const { extraQueryKeys } = options ?? {};

  // Read through a ref so the returned callback is stable and the unmount effect never re-runs.
  const refreshRef = useRef<() => void>(() => undefined);
  refreshRef.current = () => {
    void invalidateChart(queryClient, encounterId);
    extraQueryKeys?.forEach((queryKey) => void queryClient.invalidateQueries({ queryKey, exact: false }));
  };

  useEffect(() => {
    return () => refreshRef.current();
  }, []);

  return useCallback(() => refreshRef.current(), []);
};
