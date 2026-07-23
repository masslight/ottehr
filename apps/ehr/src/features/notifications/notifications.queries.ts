import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { Operation } from 'fast-json-patch';
import { Communication, Encounter, Extension, FhirResource, Location } from 'fhir/r4b';
import {
  AppointmentProviderNotificationTypes,
  getAllFhirSearchPages,
  getAllNotificationRows,
  getPatchBinary,
  getProviderNotificationPreferencesV2,
  isPhoneNumberValid,
  PROVIDER_NOTIFICATION_PREFERENCES_V2_URL,
  PROVIDER_NOTIFICATION_TYPE_SYSTEM,
  PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL,
  ProviderNotificationMethod,
  ProviderNotificationPreferencesV2,
} from 'utils';
import { useSuccessQuery } from 'utils/lib/frontend';
import { useApiClients } from '../../hooks/useAppClients';
import useEvolveUser from '../../hooks/useEvolveUser';

export type ProviderNotification = {
  appointmentID: string;
  encounter?: Encounter;
  communication: Communication;
};

export const useGetProviderNotifications = (
  onSuccess?: (data: ProviderNotification[] | null) => void
): UseQueryResult<ProviderNotification[], Error> => {
  const { oystehr } = useApiClients();
  const user = useEvolveUser();
  // "Phone only" (SMS, no bell) when every enabled row uses the Phone method — the bell has nothing to show.
  const prefs = getProviderNotificationPreferencesV2(user?.profileResource);
  const enabledRows = prefs ? getAllNotificationRows(prefs).filter((row) => row.enabled) : [];
  const isPhoneOnly =
    enabledRows.length > 0 && enabledRows.every((row) => row.method === ProviderNotificationMethod.phone);
  const queryResult = useQuery({
    queryKey: ['provider-notifications'],

    queryFn: async (): Promise<ProviderNotification[]> => {
      const notificationResources = (
        await oystehr?.fhir.search({
          resourceType: 'Communication',
          params: [
            {
              name: '_include',
              value: 'Communication:encounter',
            },
            {
              name: 'recipient',
              value: user!.profile,
            },
            {
              name: 'category',
              // Derived from the enum so a newly added type can't be silently invisible in the bell.
              value: `${PROVIDER_NOTIFICATION_TYPE_SYSTEM}|${Object.values(AppointmentProviderNotificationTypes).join(
                ','
              )}`,
            },
            {
              name: '_count',
              value: '10',
            },
            {
              name: '_sort',
              value: '-_lastUpdated',
            },
          ],
        })
      )?.unbundle();
      const communicationResources = notificationResources?.filter(
        (resourceTemp: unknown) => (resourceTemp as FhirResource).resourceType === 'Communication'
      ) as Communication[];
      const encounterResources = notificationResources?.filter(
        (resourceTemp: unknown) => (resourceTemp as FhirResource).resourceType === 'Encounter'
      ) as Encounter[];

      return communicationResources.map((communicationResource) => {
        const encounterID = communicationResource.encounter?.reference?.replace('Encounter/', '');
        const encounter = encounterResources.find((encounterTemp) => encounterID === encounterTemp.id);
        const appointmentID = encounter?.appointment?.[0].reference?.replace('Appointment/', '');

        const notification: ProviderNotification = {
          appointmentID: appointmentID || '',
          encounter,
          communication: communicationResource,
        };
        return notification;
      });
    },

    enabled: !!(oystehr && user?.profile) && !isPhoneOnly,
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};

export const useGetAllLocations = (): UseQueryResult<{ id: string; name: string }[], Error> => {
  const { oystehr } = useApiClients();
  return useQuery({
    // Same key + fetch as SchedulePage's active-locations query (shared cache entry); only the `select`
    // projection differs. Paginated so a capped page can't silently truncate the picker.
    queryKey: ['ehr-active-locations'],
    queryFn: async (): Promise<Location[]> => {
      if (!oystehr) return [];
      return getAllFhirSearchPages<Location>(
        { resourceType: 'Location', params: [{ name: 'status', value: 'active' }] },
        oystehr
      );
    },
    select: (locations): { id: string; name: string }[] =>
      locations
        .filter((location): location is Location & { id: string } => !!location.id)
        .map((location) => ({ id: location.id, name: location.name ?? location.id })),
    enabled: !!oystehr,
  });
};

export interface UpdateProviderNotificationPreferencesParams {
  preferences: ProviderNotificationPreferencesV2;
  phoneNumber?: string;
}

/**
 * Persists the per-notification-type preferences. Writes the V2 JSON blob as a child of the
 * settings extension AND the derived legacy method/task/telemed values so any code still reading the old
 * flat settings keeps working during rollout. Also syncs the SMS phone number telecom.
 */
export const useUpdateProviderNotificationPreferencesV2Mutation = (
  onSuccess: (params: UpdateProviderNotificationPreferencesParams) => void
): UseMutationResult<
  UpdateProviderNotificationPreferencesParams,
  Error,
  UpdateProviderNotificationPreferencesParams
> => {
  const user = useEvolveUser();
  const { oystehr } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['provider-notifications'],

    mutationFn: async ({ preferences, phoneNumber }: UpdateProviderNotificationPreferencesParams) => {
      if (!user?.profileResource) throw new Error('User practitioner profile not defined');

      // V2 blob is the sole source of truth. Legacy flat values (method/task/telemed flags) are no longer
      // written; the un-migrated read path derives them on the fly (getProviderNotificationPreferencesV2).
      const newNotificationSettingsExtension: Extension = {
        url: PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL,
        extension: [{ url: PROVIDER_NOTIFICATION_PREFERENCES_V2_URL, valueString: JSON.stringify(preferences) }],
      };

      const notificationsExtIndex = (user.profileResource.extension || []).findIndex(
        (ext) => ext.url === PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL
      );

      const operations: Operation[] = [];
      if (!user.profileResource.extension) {
        operations.push({ op: 'add', path: '/extension', value: [newNotificationSettingsExtension] });
      } else {
        operations.push({
          op: notificationsExtIndex >= 0 ? 'replace' : 'add',
          path: `/extension/${notificationsExtIndex >= 0 ? notificationsExtIndex : '-'}`,
          value: newNotificationSettingsExtension,
        });
      }

      // Persist any valid number regardless of method — a 'computer' user must not lose what they typed
      // on reload. SMS is still only *sent* for phone methods (see the cron).
      if (isPhoneNumberValid(phoneNumber)) {
        const telecoms = user.profileResource.telecom;
        const smsIndex = telecoms?.findIndex((t) => t.system === 'sms');
        if (smsIndex !== undefined && smsIndex >= 0) {
          operations.push({ op: 'replace', path: `/telecom/${smsIndex}/value`, value: phoneNumber });
        } else if (telecoms) {
          operations.push({ op: 'add', path: '/telecom/-', value: { system: 'sms', value: phoneNumber } });
        } else {
          operations.push({ op: 'add', path: '/telecom', value: [{ system: 'sms', value: phoneNumber }] });
        }
      }

      await oystehr?.fhir.patch({
        id: user.profileResource.id ?? '',
        resourceType: 'Practitioner',
        operations,
      });
      return { preferences, phoneNumber };
    },

    onSuccess: (params) => {
      // Refetch the cached profile — a second save would otherwise compute patch indices from a stale
      // profileResource and append a duplicate settings extension and/or `sms` telecom.
      void queryClient.refetchQueries({ queryKey: ['get-practitioner-profile'] });
      onSuccess(params);
    },
  });
};

export const useUpdateProviderNotificationsMutation = (
  onSuccess?: () => void
): UseMutationResult<void, Error, { ids: NonNullable<Communication['id']>[]; status: Communication['status'] }> => {
  const { oystehr } = useApiClients();
  return useMutation({
    mutationKey: ['provider-notifications'],

    mutationFn: async (params: { ids: NonNullable<Communication['id']>[]; status: Communication['status'] }) => {
      const { ids, status } = params;
      const patchOp: Operation = {
        op: 'replace',
        path: '/status',
        value: status,
      };

      await oystehr?.fhir.batch({
        requests: [
          ...ids.map((id) =>
            getPatchBinary({ resourceId: id, resourceType: 'Communication', patchOperations: [patchOp] })
          ),
        ],
      });
    },

    onSuccess,
  });
};
