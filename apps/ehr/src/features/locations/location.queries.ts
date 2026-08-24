import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { Location, Schedule } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { createLocation, deleteLocation, getLocation, toggleLocationActive, updateLocation } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { safelyCaptureException } from 'utils/lib/frontend/sentry';
import {
  CreateLocationParams,
  DeleteLocationParams,
  DeleteLocationResponse,
  LocationFieldsInput,
  ToggleLocationActiveParams,
} from 'utils/lib/types/api/locations';
import { APIError, isApiError } from 'utils/lib/types/errors';

const LOCATIONS_LIST_KEY = 'locations-list';
const LOCATION_KEY = 'location';
const LOCATION_SCHEDULES_KEY = 'location-schedules';

const surfaceError = (error: unknown, fallback: string): void => {
  safelyCaptureException(error);
  enqueueSnackbar(isApiError(error) ? (error as APIError).message : fallback, { variant: 'error' });
};

/** All Locations, schedule-owning or not — the entry list for Location config. */
export const useLocationsListQuery = (): UseQueryResult<Location[], Error> => {
  const { oystehr } = useApiClients();
  return useQuery({
    queryKey: [LOCATIONS_LIST_KEY],
    queryFn: async () => {
      // Paginate — a single _count-capped search silently drops Locations past the
      // first page in larger orgs. getAllFhirSearchPages follows every page.
      const resources = await getAllFhirSearchPages<Location>({ resourceType: 'Location', params: [] }, oystehr!);
      return resources.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    },
    enabled: !!oystehr,
  });
};

export const useLocationQuery = (locationId: string | undefined): UseQueryResult<Location, Error> => {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: [LOCATION_KEY, locationId],
    queryFn: async () => getLocation({ locationId: locationId! }, oystehrZambda!),
    enabled: !!oystehrZambda && !!locationId,
  });
};

/**
 * Schedules actored by this Location.
 *
 * A Location can own several — one per service category is an established pattern — so this returns
 * all of them rather than assuming a single "the" schedule. Booking links need this: prebook URLs are
 * built from Location config, but they only vend slots if a Schedule exists, and each walk-in link is
 * keyed to a specific Schedule id.
 */
export const useLocationSchedulesQuery = (locationId: string | undefined): UseQueryResult<Schedule[], Error> => {
  const { oystehr } = useApiClients();
  return useQuery({
    queryKey: [LOCATION_SCHEDULES_KEY, locationId],
    queryFn: async () =>
      getAllFhirSearchPages<Schedule>(
        { resourceType: 'Schedule', params: [{ name: 'actor', value: `Location/${locationId}` }] },
        oystehr!
      ),
    enabled: !!oystehr && !!locationId,
  });
};

export const useCreateLocationMutation = (): UseMutationResult<Location, Error, CreateLocationParams> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: CreateLocationParams) => createLocation(params, oystehrZambda!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [LOCATIONS_LIST_KEY] });
    },
    onError: (error) => surfaceError(error, 'Failed to create location.'),
  });
};

export const useUpdateLocationMutation = (
  locationId: string
): UseMutationResult<Location, Error, LocationFieldsInput> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (fields: LocationFieldsInput) => updateLocation({ locationId, ...fields }, oystehrZambda!),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [LOCATION_KEY, locationId] }),
        queryClient.invalidateQueries({ queryKey: [LOCATIONS_LIST_KEY] }),
      ]);
      enqueueSnackbar('Location saved', { variant: 'success' });
    },
    onError: (error) => surfaceError(error, 'Failed to save location.'),
  });
};

/**
 * Guarded hard-delete. Deliberately has no `onError` — the two-phase flow
 * (force=false → RESOURCE_HAS_DEPENDENTS → confirm → force=true) needs the caller to
 * branch on the error code, so it uses `mutateAsync` and handles errors itself.
 */
export const useDeleteLocationMutation = (): UseMutationResult<DeleteLocationResponse, Error, DeleteLocationParams> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: DeleteLocationParams) => deleteLocation(params, oystehrZambda!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [LOCATIONS_LIST_KEY] });
    },
  });
};

export const useToggleLocationActiveMutation = (): UseMutationResult<
  { id: string; status: string },
  Error,
  ToggleLocationActiveParams
> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: ToggleLocationActiveParams) => toggleLocationActive(params, oystehrZambda!),
    onSuccess: async (_data, { locationId, active }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [LOCATION_KEY, locationId] }),
        queryClient.invalidateQueries({ queryKey: [LOCATIONS_LIST_KEY] }),
      ]);
      enqueueSnackbar(active ? 'Location activated' : 'Location deactivated', { variant: 'success' });
    },
    onError: (error) => surfaceError(error, 'Failed to update location status.'),
  });
};
