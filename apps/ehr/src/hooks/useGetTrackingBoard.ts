import { keepPreviousData, useQuery, UseQueryResult } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { FEATURE_FLAGS } from 'src/constants/feature-flags';
import { emptyOrdersForTrackingBoardTable } from 'utils/lib/helpers/tracking-board';
import { GetAppointmentsZambdaInput, GetAppointmentsZambdaOutput } from 'utils/lib/types/api/get-appointments.types';
import { MAX_APPOINTMENT_SEARCH_RANGE_DAYS } from 'utils/lib/types/constants';
import { getAppointments } from '../api/api';
import { useApiClients } from './useAppClients';

export const TRACKING_BOARD_QUERY_KEY = 'tracking-board';

/** The board is one request per tick now, so this is the only knob for how live it feels. */
export const TRACKING_BOARD_REFRESH_MS = 30_000;

export interface TrackingBoardFilters {
  dateFrom: string | null;
  dateTo: string | null;
  locationIds: string[];
  providerIds: string[];
  serviceCategories: string[];
  visitType: string[];
}

/** The appointment buckets plus the grouped order and abnormal-vitals maps, exactly what AppointmentTabs renders. */
export type TrackingBoardData = Omit<Required<GetAppointmentsZambdaOutput>, 'message'>;

/**
 * Mirrors the zambda's own date validation so a malformed or over-long `dateFrom`/`dateTo` link never issues a
 * request that can only fail server-side. ISO dates sort lexicographically, so the string comparison is safe once
 * both are known to be valid.
 */
export const isValidTrackingBoardDateRange = (dateFrom: string | null, dateTo: string | null): boolean =>
  Boolean(
    dateFrom &&
      dateTo &&
      DateTime.fromISO(dateFrom).isValid &&
      DateTime.fromISO(dateTo).isValid &&
      dateFrom <= dateTo &&
      DateTime.fromISO(dateTo, { zone: 'utc' }).diff(DateTime.fromISO(dateFrom, { zone: 'utc' }), 'days').days <=
        MAX_APPOINTMENT_SEARCH_RANGE_DAYS
  );

/** The zambda requires at least one of location, provider or service category to scope the search. */
export const hasTrackingBoardScope = (filters: TrackingBoardFilters): boolean =>
  filters.locationIds.length > 0 || filters.providerIds.length > 0 || filters.serviceCategories.length > 0;

/**
 * Fetches everything the tracking board shows in one `get-appointments` call and polls it. React Query's per-key
 * cache replaces the page's old loading-state machine: a filter change is a new key, so a response for filters the
 * user has moved away from can never render, and the previous board stays on screen while the new one loads.
 */
export const useGetTrackingBoard = (
  filters: TrackingBoardFilters,
  options: { enabled?: boolean } = {}
): UseQueryResult<TrackingBoardData, Error> => {
  const { oystehrZambda } = useApiClients();
  const { dateFrom, dateTo, locationIds, providerIds, serviceCategories, visitType } = filters;
  const enabled =
    (options.enabled ?? true) &&
    !!oystehrZambda &&
    hasTrackingBoardScope(filters) &&
    isValidTrackingBoardDateRange(dateFrom, dateTo);

  return useQuery({
    queryKey: [TRACKING_BOARD_QUERY_KEY, { dateFrom, dateTo, locationIds, providerIds, serviceCategories, visitType }],
    queryFn: async (): Promise<TrackingBoardData> => {
      if (!oystehrZambda) throw new Error('oystehrZambda not defined');
      if (!dateFrom || !dateTo) throw new Error('a date range is required');

      const input: GetAppointmentsZambdaInput = {
        searchDateFrom: dateFrom,
        searchDateTo: dateTo,
        timezone: DateTime.now().zoneName,
        locationIds,
        providerIds,
        serviceCategories,
        visitType,
        supervisorApprovalEnabled: FEATURE_FLAGS.SUPERVISOR_APPROVAL_ENABLED,
      };
      const result = await getAppointments(oystehrZambda, input);

      // The zambda always returns both maps; the fallbacks only cover a rolling deploy where the backend still
      // runs the shape from before they were added.
      return {
        preBooked: result.preBooked ?? [],
        inOffice: result.inOffice ?? [],
        completed: result.completed ?? [],
        cancelled: result.cancelled ?? [],
        orders: result.orders ?? emptyOrdersForTrackingBoardTable(),
        vitals: result.vitals ?? {},
      };
    },
    enabled,
    refetchInterval: TRACKING_BOARD_REFRESH_MS,
    // Pauses the interval while the tab is hidden, which is what the page's visibility check used to do.
    refetchIntervalInBackground: false,
    // Keep the last board on screen while a filter change is in flight instead of flashing an empty table.
    placeholderData: keepPreviousData,
    retry: 1,
  });
};
