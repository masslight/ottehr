import { keepPreviousData, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { FEATURE_FLAGS } from 'src/constants/feature-flags';
import { getAppointmentSearchDateRangeError } from 'utils/lib/helpers/appointment-search';
import { GetAppointmentsZambdaInput, GetAppointmentsZambdaOutput } from 'utils/lib/types/api/get-appointments.types';
import { getAppointments } from '../api/api';
import { useApiClients } from './useAppClients';

export const TRACKING_BOARD_QUERY_KEY = 'tracking-board';

export const TRACKING_BOARD_REFRESH_MS = 30_000;

export interface TrackingBoardFilters {
  dateFrom: string | null;
  dateTo: string | null;
  locationIds: string[];
  providerIds: string[];
  serviceCategories: string[];
  visitType: string[];
}

export type TrackingBoardData = Omit<Required<GetAppointmentsZambdaOutput>, 'message' | 'ordersAndVitalsIncomplete'>;

export const hasTrackingBoardScope = (filters: TrackingBoardFilters): boolean =>
  filters.locationIds.length > 0 || filters.providerIds.length > 0 || filters.serviceCategories.length > 0;

export const useGetTrackingBoard = (
  filters: TrackingBoardFilters,
  options: { enabled?: boolean } = {}
): UseQueryResult<TrackingBoardData, Error> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  const { dateFrom, dateTo, locationIds, providerIds, serviceCategories, visitType } = filters;
  const enabled =
    (options.enabled ?? true) &&
    !!oystehrZambda &&
    hasTrackingBoardScope(filters) &&
    !!dateFrom &&
    !!dateTo &&
    getAppointmentSearchDateRangeError(dateFrom, dateTo) === undefined;
  const queryKey = [
    TRACKING_BOARD_QUERY_KEY,
    { dateFrom, dateTo, locationIds, providerIds, serviceCategories, visitType },
  ];

  return useQuery({
    queryKey,
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

      // When one of the server's order/vitals searches failed, the maps are missing entries. Keep the previous
      // tick's maps for this key instead of blanking every icon and badge for 30 s; the rows themselves are current.
      const previous = result.ordersAndVitalsIncomplete
        ? queryClient.getQueryData<TrackingBoardData>(queryKey)
        : undefined;
      if (result.ordersAndVitalsIncomplete) {
        console.warn('tracking board orders/vitals were incomplete; keeping the previous icons', {
          keptPrevious: previous !== undefined,
        });
      }

      return {
        preBooked: result.preBooked,
        inOffice: result.inOffice,
        completed: result.completed,
        cancelled: result.cancelled,
        orders: previous?.orders ?? result.orders,
        vitals: previous?.vitals ?? result.vitals,
      };
    },
    enabled,
    refetchInterval: TRACKING_BOARD_REFRESH_MS,
    // Pauses the interval while the tab is hidden.
    refetchIntervalInBackground: false,
    // Keep the last board on screen while a filter change is in flight instead of flashing an empty table.
    placeholderData: keepPreviousData,
    retry: 1,
  });
};
