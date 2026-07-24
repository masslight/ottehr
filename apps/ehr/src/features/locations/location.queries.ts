import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { Location } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { createLocation, getLocation, toggleLocationActive, updateLocation } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { APIError, CreateLocationParams, isApiError, LocationFieldsInput, ToggleLocationActiveParams } from 'utils';
import { safelyCaptureException } from 'utils/lib/frontend/sentry';

const LOCATIONS_LIST_KEY = 'locations-list';
const LOCATION_KEY = 'location';

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
      const resources = await oystehr!.fhir.search<Location>({
        resourceType: 'Location',
        params: [{ name: '_count', value: '1000' }],
      });
      return resources.unbundle().sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
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
