import { QueryObserverResult, RefetchOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { CHART_FIELDS_QUERY_KEY } from 'src/constants';
import useEvolveUser from 'src/hooks/useEvolveUser';
import {
  ChartDataRequestedFields,
  GetChartDataResponse,
  RequestedFields,
  SearchParams,
  useErrorQuery,
  useSuccessQuery,
} from 'utils';
import { useAppointmentData } from '../stores/appointment/appointment.store';
import { useGetAppointmentAccessibility } from './useGetAppointmentAccessibility';
import { useOystehrAPIClient } from './useOystehrAPIClient';

type ReactQueryState = {
  error: any;
  isLoading: boolean;
  refetch: (options?: RefetchOptions | undefined) => Promise<QueryObserverResult<unknown, unknown>>;
  isFetching: boolean;
  isPending: boolean;
  isFetched: boolean;
};

type ChartFieldsResponse = Pick<GetChartDataResponse, RequestedFields>;

interface ChartDataFieldStateUpdater<T extends Partial<ChartFieldsResponse>> {
  setQueryCache: (updater: Partial<T> | ((state: T) => Partial<T>)) => void;
}

// returns stringified and sorted representation fro the requested fields
const createSearchParamsKey = (searchParams: ChartDataRequestedFields): string => {
  return JSON.stringify(searchParams, (_key: string, value: unknown) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce(
          (sorted: Record<string, unknown>, k: string) => {
            sorted[k] = (value as Record<string, unknown>)[k];
            return sorted;
          },
          {} as Record<string, unknown>
        );
    }
    return value;
  });
};

const searchParamsMatch = (params1: SearchParams, params2: SearchParams): boolean => {
  return JSON.stringify(params1, Object.keys(params1).sort()) === JSON.stringify(params2, Object.keys(params2).sort());
};

/**
 * Hook for fetching and managing chart data fields.
 *
 * This hook implements a caching strategy that replaces the common cache with standard react-query caches:
 * - Cache key structure: ['chart-data-fields', encounterId, searchParamsKey, isReadOnly]
 * - Only requested fields are fetched and returned from the API
 *
 * CACHING LOGIC:
 * - Each combination of requested fields + search params gets its own cache entry
 * - setQueryCache(...) updates ALL caches containing the same field with EXACT search params match
 * - Caches with the same field but DIFFERENT search params are invalidated (not updated)
 * - This ensures data consistency: if field X with params Y is updated, all caches
 *   requesting field X with params Y get the update, others are invalidated to refetch
 *
 * USAGE PATTERNS:
 * ```typescript
 * // Fetch specific fields with search params:
 * const { data, setQueryCache } = useChartDataField({
 *   searchParams: {
 *     observations: { _sort: 'date', _count: 10 },
 *     examObservations: { _include: 'Patient' }
 *   }
 * });
 *
 * // Update cache optimistically:
 * setQueryCache({ observations: localObservationsData });
 *
 * // Or with function:
 * setQueryCache((currentData) => ({
 *   ...currentData,
 *   observations: [...currentData.observations, newObservation],
 * }));
 * ```
 */
export function useChartFields<T extends ChartDataRequestedFields>({
  requestedFields,
  appointmentId,
  enabled = true,
  onSuccess,
  onError,
  refetchInterval,
}: {
  requestedFields: T;
  appointmentId?: string;
  enabled?: boolean;
  onSuccess?: (data: ChartFieldsResponse | null) => void;
  onError?: (error: unknown) => void;
  refetchInterval?: number;
}): {
  data: { [K in keyof T]: K extends keyof ChartFieldsResponse ? ChartFieldsResponse[K] : never } | undefined;
} & ChartDataFieldStateUpdater<ChartFieldsResponse> &
  ReactQueryState {
  const apiClient = useOystehrAPIClient();
  const { id: appointmentIdFromUrl } = useParams();
  const { encounter } = useAppointmentData(appointmentId || appointmentIdFromUrl);
  const encounterId = encounter?.id;
  const queryClient = useQueryClient();
  const user = useEvolveUser();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const queryKey = [CHART_FIELDS_QUERY_KEY, encounterId, createSearchParamsKey(requestedFields), isReadOnly];

  const { data, error, isLoading, isFetching, isFetched, refetch, isPending } = useQuery({
    queryKey,
    queryFn: async (): Promise<Pick<GetChartDataResponse, keyof ChartDataRequestedFields>> => {
      if (!apiClient || !encounterId) {
        throw new Error('API client not defined or encounterId not provided');
      }

      const response = await apiClient.getChartData({
        encounterId,
        requestedFields,
      });

      const result: Partial<GetChartDataResponse> = {};

      (Object.keys(requestedFields) as Array<keyof GetChartDataResponse>).forEach((field) => {
        if (field in response) {
          (result as Record<string, unknown>)[field] = (response as unknown as Record<string, unknown>)[field];
        }
      });

      return result as Pick<GetChartDataResponse, keyof ChartDataRequestedFields>;
    },
    enabled: !!apiClient && !!encounterId && !!user && enabled,
    staleTime: 0, // TODO: add QUERY_STALE_TIME; set to 0 for now since not all api calls update cache (e.g., in-house order status changes to "collected")
    refetchInterval: refetchInterval || false,
  });

  useSuccessQuery(data, onSuccess);

  useErrorQuery(error, onError);

  const setQueryCache = useCallback(
    (
      updater:
        | Partial<Pick<GetChartDataResponse, keyof ChartDataRequestedFields>>
        | ((
            state: Pick<GetChartDataResponse, keyof ChartDataRequestedFields>
          ) => Partial<Pick<GetChartDataResponse, keyof ChartDataRequestedFields>>)
    ) => {
      const allQueries = queryClient.getQueryCache().getAll();

      const relevantQueries = allQueries.filter((query) => {
        const [base, encId] = query.queryKey;
        return base === CHART_FIELDS_QUERY_KEY && encId === encounterId;
      });

      relevantQueries.forEach((query) => {
        const [, , searchParamsKey] = query.queryKey;
        const currentData = queryClient.getQueryData(query.queryKey);

        if (!currentData) return;

        try {
          const parsedRequestedFields = JSON.parse((searchParamsKey as string) || '{}');

          const updates =
            typeof updater === 'function'
              ? updater(currentData as Pick<GetChartDataResponse, keyof ChartDataRequestedFields>)
              : updater;

          const fieldsToUpdate = Object.keys(updates);

          let shouldUpdate = false;
          let shouldInvalidate = false;

          fieldsToUpdate.forEach((fieldName) => {
            if (fieldName in parsedRequestedFields) {
              // Compare the query's field search params with the current hook's field search params
              const queryFieldSearchParams = parsedRequestedFields[fieldName];
              const currentFieldSearchParams = requestedFields[fieldName as keyof typeof requestedFields];

              if (searchParamsMatch(queryFieldSearchParams, currentFieldSearchParams as SearchParams)) {
                shouldUpdate = true;
              } else {
                shouldInvalidate = true;
              }
            }
          });

          if (shouldUpdate) {
            queryClient.setQueryData(query.queryKey, (prevData: any) => {
              if (!prevData) return prevData;
              return { ...prevData, ...updates };
            });
          } else if (shouldInvalidate) {
            void queryClient.invalidateQueries({
              queryKey: query.queryKey,
              exact: true,
              refetchType: 'active',
            });
          }
        } catch {
          return;
        }
      });
    },
    [queryClient, encounterId, requestedFields]
  );

  return {
    data,
    error,
    isLoading,
    isFetching,
    isFetched,
    refetch,
    isPending,
    setQueryCache,
  } as {
    data: { [K in keyof T]: K extends keyof ChartFieldsResponse ? ChartFieldsResponse[K] : never } | undefined;
  } & ChartDataFieldStateUpdater<Pick<GetChartDataResponse, keyof ChartDataRequestedFields>> &
    ReactQueryState;
}
