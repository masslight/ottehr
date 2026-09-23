import { hashKey, QueryObserverResult, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { cancelChartReads, chartSectionQueryKey, chartSectionsQueryKey, readChartSection } from './chartSectionCache';
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
   * without a round trip. Reads in flight for the section are cancelled first, so none of them lands its
   * older rows over the write. The section's other option-set variants are marked stale and refetch where shown.
   */
  setSectionData: (updater: ChartSectionUpdater<S>) => void;
  encounterId: string | undefined;
}

/**
 * One chart section of a visit (get-chart-section). Fresh within a screen for everything that mounts the
 * same section; a screen change marks it stale, so the next screen that shows it re-reads it once. A read
 * that starts while a visit-note read is in flight takes that read's seed instead (readChartSection).
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

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<ChartSectionData<S>> => {
      if (!apiClient || !encounterId) throw new Error('API client not defined or encounterId not provided');
      return readChartSection(queryClient, apiClient, encounterId, section, params as ChartSectionParams<S>);
    },
    enabled: ready,
    staleTime: QUERY_STALE_TIME,
    refetchInterval: refetchInterval || false,
  });

  useSuccessQuery(query.data, (data) => {
    if (data) onSuccess?.(data);
  });
  useErrorQuery(query.error, onError);

  const setSectionData = useCallback(
    (updater: ChartSectionUpdater<S>): void => {
      if (encounterId) cancelChartReads(queryClient, encounterId, section);
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
