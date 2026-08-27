import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { getProviderNotificationPreferencesV2 } from 'utils/lib/fhir/patient';
import { useSuccessQuery } from 'utils/lib/frontend';
import { ProviderNotificationMethod } from 'utils/lib/types/api/practitioner.types';
import {
  getAllNotificationRows,
  MarkProviderNotificationsReadInput,
  ProviderNotificationDto,
  UpdateProviderNotificationSettingsInput,
} from 'utils/lib/types/api/provider-notifications';
import {
  getProviderNotifications,
  listActiveLocations,
  markProviderNotificationsRead,
  updateProviderNotificationSettings,
} from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import useEvolveUser from '../../hooks/useEvolveUser';

/**
 * Everything the notification bell and its settings page read or write goes through zambdas, so no
 * notification `Communication`, `Practitioner`, or `Location` is fetched or patched from the browser.
 * The endpoints derive the practitioner they act for from the caller's token: nothing here names a
 * recipient or a profile id, and there is nothing for a caller to swap.
 */

const PROVIDER_NOTIFICATIONS_QUERY_KEY = 'provider-notifications';

export const useGetProviderNotifications = (
  onSuccess?: (data: ProviderNotificationDto[] | null) => void
): UseQueryResult<ProviderNotificationDto[], Error> => {
  const { oystehrZambda } = useApiClients();
  const user = useEvolveUser();
  // "Phone only" (SMS, no bell) when every enabled row uses the Phone method — the bell has nothing to
  // show, so don't poll for it. Computed from the already-cached profile, which is why it stays here
  // rather than in the endpoint: server-side it would cost a Practitioner read on every tick.
  const prefs = getProviderNotificationPreferencesV2(user?.profileResource);
  const enabledRows = prefs ? getAllNotificationRows(prefs).filter((row) => row.enabled) : [];
  const isPhoneOnly =
    enabledRows.length > 0 && enabledRows.every((row) => row.method === ProviderNotificationMethod.phone);

  const queryResult = useQuery({
    // Keyed by profile so a sign-out/sign-in as someone else can't render the previous user's
    // notifications from cache while the first poll is in flight.
    queryKey: [PROVIDER_NOTIFICATIONS_QUERY_KEY, user?.profile],

    queryFn: async (): Promise<ProviderNotificationDto[]> => {
      const { notifications } = await getProviderNotifications(oystehrZambda!);
      return notifications;
    },

    enabled: !!(oystehrZambda && user?.profile) && !isPhoneOnly,
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};

export const useGetAllLocations = (): UseQueryResult<{ id: string; name: string }[], Error> => {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: ['ehr-active-locations'],
    queryFn: async (): Promise<{ id: string; name: string }[]> => {
      const { locations } = await listActiveLocations(oystehrZambda!);
      return locations;
    },
    enabled: !!oystehrZambda,
  });
};

export type UpdateProviderNotificationPreferencesParams = UpdateProviderNotificationSettingsInput;

/**
 * Persists the per-notification-type preferences and the SMS number for the signed-in user.
 *
 * The endpoint reads the Practitioner fresh and builds the patch from that, so saving twice in one
 * session can no longer append a duplicate settings extension or `sms` telecom — which is what the
 * profile refetch below used to be guarding against. The refetch stays because the cached Practitioner
 * is still what `useEvolveUser` and the employee pages read preferences from.
 */
export const useUpdateProviderNotificationPreferencesV2Mutation = (
  onSuccess: (params: UpdateProviderNotificationPreferencesParams) => void
): UseMutationResult<
  UpdateProviderNotificationPreferencesParams,
  Error,
  UpdateProviderNotificationPreferencesParams
> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [PROVIDER_NOTIFICATIONS_QUERY_KEY],

    mutationFn: async (params: UpdateProviderNotificationPreferencesParams) =>
      updateProviderNotificationSettings(params, oystehrZambda!),

    onSuccess: (stored) => {
      void queryClient.refetchQueries({ queryKey: ['get-practitioner-profile'] });
      // Hands back what was actually stored — normalized preferences and the effective phone number —
      // rather than what was sent, so the form reseeds from server truth.
      onSuccess(stored);
    },
  });
};

export const useUpdateProviderNotificationsMutation = (
  onSuccess?: () => void
): UseMutationResult<void, Error, MarkProviderNotificationsReadInput> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [PROVIDER_NOTIFICATIONS_QUERY_KEY],

    mutationFn: async (params: MarkProviderNotificationsReadInput) => {
      await markProviderNotificationsRead(params, oystehrZambda!);
    },

    onSuccess: async () => {
      // Without this the badge stayed lit until the next 10-second poll, even though the user had just
      // opened the menu and read everything in it.
      await queryClient.invalidateQueries({ queryKey: [PROVIDER_NOTIFICATIONS_QUERY_KEY] });
      onSuccess?.();
    },
  });
};
