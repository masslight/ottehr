import { QueryKey, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useErrorQuery, useSuccessQuery } from 'utils/lib/frontend';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { ObservationDTO } from 'utils/lib/types/data/screening-questions/types';
import { useExamObservations } from '../../telemed/hooks/useExamObservations';
import type { ChartDataResponse, ChartDataState } from '../stores/appointment/appointment.store';
import { invalidateChartSections, visitNoteQueryKey } from './chartSectionCache';
import {
  applyLegacyChartPatch,
  legacyChartDataFromVisitNote,
  readLegacyChartData,
  upsertObservation,
} from './legacyChartData';
import { useRosObservations } from './useRosObservations';
import { useVisitNote } from './useVisitNote';

type ChartDataStateUpdater = Partial<ChartDataState> | ((state: ChartDataState) => Partial<ChartDataState>);

export interface UseChartDataResult extends ChartDataState {
  refetch: () => Promise<void>;
  chartDataRefetch: () => Promise<void>;
  isLoading: boolean;
  isFetching: boolean;
  isFetched: boolean;
  isPending: boolean;
  error: unknown;
  chartDataError: unknown;
  queryKey: QueryKey;
  setPartialChartData: (value: Partial<GetChartDataResponse>, opts?: { invalidateQueries?: boolean }) => void;
  updateObservation: (observation: ObservationDTO) => void;
  chartDataSetState: (updater: ChartDataStateUpdater, opts?: { invalidateQueries?: boolean }) => void;
}

/**
 * The whole chart of a visit in the `GetChartDataResponse` shape, read from the section caches (see
 * useVisitNote). Writes go to the section each field lives in; with `invalidateQueries` (the default) the
 * touched sections are then re-read where they are shown, one small call per section.
 *
 * Screens that show one section should read it with `useChartSection` instead; this hook stays for the
 * places that still read the chart as a whole.
 */
export const useChartData = ({
  appointmentId,
  shouldUpdateExams,
  onSuccess,
  onError,
  enabled = true,
  refetchInterval,
  refetchOnMount,
  encounterId: paramEncounterId,
}: {
  appointmentId?: string;
  onSuccess?: (data: ChartDataResponse | null) => void;
  onError?: (error: any) => void;
  enabled?: boolean;
  /** Hydrate the exam and ROS stores from the exam section whenever it changes (the visit layout does this). */
  shouldUpdateExams?: boolean;
  refetchInterval?: number;
  refetchOnMount?: boolean;
  encounterId?: string;
} = {}): UseChartDataResult => {
  const queryClient = useQueryClient();
  const { update: updateExamObservations } = useExamObservations();
  const { update: updateRosObservations } = useRosObservations();

  const visitNote = useVisitNote({
    appointmentId,
    ...(paramEncounterId !== undefined ? { encounterId: paramEncounterId } : {}),
    enabled,
    refetchInterval,
    // A screen change marks the note stale; a whole-chart reader lives off the section refreshes the
    // screens make rather than re-reading the note on every screen.
    refetchOnMount: refetchOnMount ?? false,
  });
  const { encounterId, data: note } = visitNote;

  const chartData = useMemo(
    (): ChartDataResponse | undefined => (note ? (legacyChartDataFromVisitNote(note) as ChartDataResponse) : undefined),
    [note]
  );

  useSuccessQuery(chartData, (data) => {
    if (data) onSuccess?.(data);
  });
  useErrorQuery(visitNote.error, onError);

  // Fires once per exam-section change (a read, a save, a patch), like the chart read's success used to.
  const exam = note?.exam;
  useSuccessQuery(exam, (data) => {
    if (!data || !shouldUpdateExams) return;
    updateExamObservations(data.examObservations, true);
    updateRosObservations(data.rosObservations ?? [], true);
  });

  const setPartialChartData = useCallback(
    (data: Partial<GetChartDataResponse>, opts: { invalidateQueries?: boolean } = { invalidateQueries: true }) => {
      if (!encounterId) return;
      const touched = applyLegacyChartPatch(queryClient, encounterId, data);
      if (opts.invalidateQueries !== false) void invalidateChartSections(queryClient, encounterId, touched);
    },
    [queryClient, encounterId]
  );

  const chartDataSetState = useCallback(
    (updater: ChartDataStateUpdater, opts: { invalidateQueries?: boolean } = { invalidateQueries: true }) => {
      if (!encounterId) return;
      // Read the caches rather than the last render, so back-to-back writes each start from the latest state.
      const current = readLegacyChartData(queryClient, encounterId) as ChartDataResponse | undefined;
      const next = typeof updater === 'function' ? updater({ chartData: current, isChartDataLoading: false }) : updater;
      if (!next.chartData) return;
      const changed: Partial<GetChartDataResponse> = {};
      const keys = new Set([...Object.keys(next.chartData), ...Object.keys(current ?? {})]) as Set<
        keyof GetChartDataResponse
      >;
      keys.forEach((key) => {
        if (next.chartData?.[key as keyof ChartDataResponse] !== current?.[key as keyof ChartDataResponse]) {
          (changed as Record<string, unknown>)[key] = next.chartData?.[key as keyof ChartDataResponse];
        }
      });
      if (Object.keys(changed).length > 0) setPartialChartData(changed, opts);
    },
    [queryClient, encounterId, setPartialChartData]
  );

  const updateObservation = useCallback(
    (observation: ObservationDTO) => {
      if (!encounterId) return;
      const section = upsertObservation(queryClient, encounterId, observation);
      void invalidateChartSections(queryClient, encounterId, [section]);
    },
    [queryClient, encounterId]
  );

  return {
    refetch: visitNote.refetch,
    chartDataRefetch: visitNote.refetch,
    chartData,
    isLoading: visitNote.isLoading,
    isChartDataLoading: visitNote.isLoading,
    error: visitNote.error,
    chartDataError: visitNote.error,
    queryKey: visitNoteQueryKey(encounterId),
    isFetching: visitNote.isFetching,
    isFetched: visitNote.isFetched,
    isPending: note === undefined,
    setPartialChartData,
    updateObservation,
    chartDataSetState,
  };
};
