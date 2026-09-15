import {
  hashKey,
  QueryClient,
  QueryObserverResult,
  useIsFetching,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { QUERY_STALE_TIME } from 'src/constants';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { useErrorQuery, useSuccessQuery } from 'utils/lib/frontend';
import {
  ChartSection,
  ChartSectionData,
  ChartSectionParams,
} from 'utils/lib/types/api/chart-data/chart-sections.types';
import { useAppointmentData } from '../stores/appointment/appointment.store';
import { chartSectionQueryKey, chartSectionsQueryKey, fetchChartSection, visitNoteQueryKey } from './chartSectionCache';
import { useOystehrAPIClient } from './useOystehrAPIClient';

export type ChartSectionUpdater<S extends ChartSection> =
  | Partial<ChartSectionData<S>>
  | ((previous: ChartSectionData<S>) => Partial<ChartSectionData<S>>);

export interface UseChartSectionOptions<S extends ChartSection> {
  /** The section's option set (the note types for `notes`, a page size for `history`). */
  params?: ChartSectionParams<S>;
  /** Defaults to the current appointment's encounter. */
  encounterId?: string;
  appointmentId?: string;
  enabled?: boolean;
  refetchInterval?: number;
  onSuccess?: (data: ChartSectionData<S>) => void;
  onError?: (error: unknown) => void;
}

export interface UseChartSectionResult<S extends ChartSection> {
  data: ChartSectionData<S> | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isFetched: boolean;
  isPending: boolean;
  error: unknown;
  refetch: () => Promise<QueryObserverResult<ChartSectionData<S>, Error>>;
  /**
   * Writes into this section's cache entry — typically what a save just returned — so the screen shows it
   * without a round trip. The section's other option-set variants are marked stale and refetch where shown.
   */
  setSectionData: (updater: ChartSectionUpdater<S>) => void;
  encounterId: string | undefined;
}

/**
 * If a visit-note read for the encounter is in flight, waits for it to finish: it seeds every section, so a
 * section mounted in the same render must not ask for its data a second time. The initial yield lets the
 * rest of the render's observers subscribe first (children mount before their layout, so a section's fetch
 * would otherwise start before the visit note's).
 */
async function waitForVisitNoteInFlight(queryClient: QueryClient, encounterId: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  const cache = queryClient.getQueryCache();
  const visitNote = cache.find({ queryKey: visitNoteQueryKey(encounterId), exact: true });
  if (visitNote?.state.fetchStatus !== 'fetching') return;
  await new Promise<void>((resolve) => {
    const unsubscribe = cache.subscribe((event) => {
      if (event.query === visitNote && visitNote.state.fetchStatus !== 'fetching') {
        unsubscribe();
        resolve();
      }
    });
  });
}

/**
 * One chart section of a visit (get-chart-section). Fresh within a screen for everything that mounts the
 * same section; a screen change marks it stale, so the next screen that shows it re-reads it once.
 *
 * While a visit-note read for the encounter is in flight the section waits for it (waitForVisitNoteInFlight).
 */
export function useChartSection<S extends ChartSection>(
  section: S,
  options: UseChartSectionOptions<S> = {}
): UseChartSectionResult<S> {
  const { params, appointmentId, enabled = true, refetchInterval, onSuccess, onError } = options;
  const apiClient = useOystehrAPIClient();
  const user = useEvolveUser();
  const queryClient = useQueryClient();
  const { id: appointmentIdFromUrl } = useParams();
  const { encounter } = useAppointmentData(appointmentId || appointmentIdFromUrl);
  // An explicit encounterId is authoritative, even when undefined (a follow-up whose parent is not loaded
  // yet must not fall back to the current encounter).
  const encounterId = 'encounterId' in options ? options.encounterId : encounter?.id;
  const ready = !!apiClient && !!encounterId && !!user && enabled;

  const queryKey = chartSectionQueryKey(encounterId, section, params);
  const visitNoteInFlight = useIsFetching({ queryKey: visitNoteQueryKey(encounterId) }) > 0;

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<ChartSectionData<S>> => {
      if (!apiClient || !encounterId) throw new Error('API client not defined or encounterId not provided');
      // A visit-note read that lands while this fetch is starting seeds this very entry; take that seed.
      const before = queryClient.getQueryState(queryKey)?.dataUpdatedAt ?? 0;
      await waitForVisitNoteInFlight(queryClient, encounterId);
      const seeded = queryClient.getQueryState<ChartSectionData<S>>(queryKey);
      if (seeded?.data !== undefined && seeded.dataUpdatedAt > before) return seeded.data;
      return fetchChartSection(apiClient, encounterId, section, params as ChartSectionParams<S>);
    },
    enabled: ready && !visitNoteInFlight,
    staleTime: QUERY_STALE_TIME,
    refetchInterval: refetchInterval || false,
  });

  useSuccessQuery(query.data, (data) => {
    if (data) onSuccess?.(data);
  });
  useErrorQuery(query.error, onError);

  const setSectionData = useCallback(
    (updater: ChartSectionUpdater<S>): void => {
      const previous = queryClient.getQueryData<ChartSectionData<S>>(queryKey);
      if (previous !== undefined) {
        const patch = typeof updater === 'function' ? updater(previous) : updater;
        queryClient.setQueryData<ChartSectionData<S>>(queryKey, { ...previous, ...patch });
      }
      const own = hashKey(queryKey);
      queryClient
        .getQueryCache()
        .findAll({ queryKey: chartSectionsQueryKey(encounterId, section) })
        .forEach((other) => {
          if (hashKey(other.queryKey) !== own) {
            void queryClient.invalidateQueries({ queryKey: other.queryKey, exact: true });
          }
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, hashKey(queryKey), encounterId, section]
  );

  return {
    data: query.data,
    isLoading: ready && query.data === undefined && !query.error,
    isFetching: query.isFetching,
    isFetched: query.isFetched || query.data !== undefined,
    isPending: query.data === undefined,
    error: query.error,
    refetch: query.refetch as UseChartSectionResult<S>['refetch'],
    setSectionData,
    encounterId,
  };
}
