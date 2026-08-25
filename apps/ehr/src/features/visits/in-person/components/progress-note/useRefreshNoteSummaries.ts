import { QueryKey, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { CHART_FIELDS_QUERY_KEY } from 'src/constants';
import { useAppointmentData, useChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';

interface UseRefreshNoteSummariesOptions {
  // query keys the section's own summary reads from, when it is not served by chart data
  // or chart fields (e.g. the immunization orders list)
  extraQueryKeys?: QueryKey[];
}

/**
 * Keeps the Review & Sign summaries in sync with an inline edit flow.
 *
 * The ordering flows write through their own APIs rather than save-chart-data, so nothing
 * refreshes the note on its own. Refreshing means invalidating both chart queries:
 * `useChartData` (procedures, diagnoses, billing codes) and `useChartFields` (lab results,
 * radiology orders, prescriptions, notes) are separate caches under separate keys, and the
 * chart-fields observer lives in ProgressNoteDetails, which stays mounted while a section
 * is open — so it never refetches unless it is invalidated explicitly.
 *
 * Returns a stable callback to call when the flow returns to its list; it also runs once
 * when the section collapses.
 */
export const useRefreshNoteSummaries = (options?: UseRefreshNoteSummariesOptions): (() => void) => {
  const { encounter } = useAppointmentData();
  const encounterId = encounter?.id;
  const { refetch } = useChartData();
  const queryClient = useQueryClient();
  const extraQueryKeys = options?.extraQueryKeys;

  // Read through a ref so the returned callback stays stable no matter how the caller
  // spells its options, and so the collapse-time refresh doesn't need the effect to re-run.
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
