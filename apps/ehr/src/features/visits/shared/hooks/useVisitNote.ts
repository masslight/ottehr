import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { QUERY_STALE_TIME } from 'src/constants';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { CHART_SECTIONS, ChartSection, ChartSectionData } from 'utils/lib/types/api/chart-data/chart-sections.types';
import { VisitNoteResponse } from 'utils/lib/types/api/chart-data/get-visit-note.types';
import { useAppointmentData } from '../stores/appointment/appointment.store';
import {
  chartSectionQueryKey,
  fetchChartSection,
  seedChartSectionsFromVisitNote,
  visitNoteQueryKey,
  visitNoteSectionParams,
} from './chartSectionCache';
import { useOystehrAPIClient } from './useOystehrAPIClient';

export interface UseVisitNoteOptions {
  /** Defaults to the current appointment's encounter. */
  encounterId?: string;
  appointmentId?: string;
  enabled?: boolean;
  refetchInterval?: number;
  /**
   * Whether mounting refetches a stale note (default true). A screen change marks the note stale, so the
   * visit-note pages re-read it on entry; whole-chart readers on the other screens pass false and live off
   * the section refreshes those screens make.
   */
  refetchOnMount?: boolean;
}

export interface UseVisitNoteResult {
  /**
   * The note, with every section read live from its section cache entry; undefined until every part is
   * loaded. Only the fields that are not sections (vitals, labs, radiology, participants, previous visits)
   * come from the visit-note read itself.
   */
  data: VisitNoteResponse | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isFetched: boolean;
  error: unknown;
  /** Re-reads the whole note in one call and re-seeds every section from it. */
  refetch: () => Promise<void>;
  encounterId: string | undefined;
}

/** `useMemo` over a dependency list whose length is fixed but only known at runtime. */
const useShallowMemo = <T>(factory: () => T, deps: readonly unknown[]): T => {
  const ref = useRef<{ deps: readonly unknown[]; value: T }>();
  if (!ref.current || ref.current.deps.length !== deps.length || ref.current.deps.some((d, i) => d !== deps[i])) {
    ref.current = { deps, value: factory() };
  }
  return ref.current.value;
};

/**
 * The whole chart of a visit: one get-visit-note read that seeds every section's cache entry, plus live
 * observers on those entries, so a save that patches or refetches a section shows up here too.
 *
 * The section observers wait while a visit-note read is in flight and never refetch on mount by
 * themselves: the visit-note read is what refreshes them on page entry, and a screen that shows one
 * section refreshes that section through `useChartSection`.
 */
export const useVisitNote = (options: UseVisitNoteOptions = {}): UseVisitNoteResult => {
  const { appointmentId, enabled = true, refetchInterval, refetchOnMount = true } = options;
  const apiClient = useOystehrAPIClient();
  const user = useEvolveUser();
  const queryClient = useQueryClient();
  const { id: appointmentIdFromUrl } = useParams();
  const { encounter } = useAppointmentData(appointmentId || appointmentIdFromUrl);
  // An explicit encounterId is authoritative, even when undefined (a follow-up whose parent is not loaded
  // yet must not fall back to the current encounter).
  const encounterId = 'encounterId' in options ? options.encounterId : encounter?.id;
  const ready = !!apiClient && !!encounterId && !!user && enabled;

  const note = useQuery({
    queryKey: visitNoteQueryKey(encounterId),
    queryFn: async (): Promise<VisitNoteResponse> => {
      if (!apiClient || !encounterId) throw new Error('API client not defined or encounterId not provided');
      const response = await apiClient.getVisitNote({ encounterId });
      // Seeded before the note lands in its own entry, so the section observers below find fresh data
      // the moment they are enabled again and never fetch on their own.
      seedChartSectionsFromVisitNote(queryClient, encounterId, response);
      return response;
    },
    enabled: ready,
    staleTime: QUERY_STALE_TIME,
    refetchInterval: refetchInterval || false,
    refetchOnMount,
  });

  const sections = useQueries({
    queries: CHART_SECTIONS.map((section) => ({
      queryKey: chartSectionQueryKey(encounterId, section, visitNoteSectionParams(section)),
      queryFn: async (): Promise<ChartSectionData> => {
        if (!apiClient || !encounterId) throw new Error('API client not defined or encounterId not provided');
        return fetchChartSection(apiClient, encounterId, section, visitNoteSectionParams(section));
      },
      enabled: ready && !note.isFetching,
      staleTime: QUERY_STALE_TIME,
      refetchOnMount: false as const,
    })),
  });

  const sectionData = sections.map((query) => query.data);
  const data = useShallowMemo((): VisitNoteResponse | undefined => {
    if (!note.data || sectionData.some((section) => section === undefined)) return undefined;
    const assembled: Record<string, unknown> = { ...note.data };
    CHART_SECTIONS.forEach((section: ChartSection, index) => {
      assembled[section] = sectionData[index];
    });
    return assembled as unknown as VisitNoteResponse;
  }, [note.data, ...sectionData]);

  const error = note.error ?? sections.find((query) => query.error)?.error;

  const refetch = useCallback(async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: visitNoteQueryKey(encounterId) });
  }, [queryClient, encounterId]);

  return {
    data,
    isLoading: ready && data === undefined && !error,
    isFetching: note.isFetching || sections.some((query) => query.isFetching),
    isFetched: data !== undefined || note.isFetched,
    error,
    refetch,
    encounterId,
  };
};
