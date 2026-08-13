import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { Operation } from 'fast-json-patch';
// FAX_NOTIFICATIONS_DISABLED: re-add `Task as FhirTask` below for the commented-out fax link plumbing.
import { Communication, Encounter, Extension, FhirResource, Location } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { getProviderNotificationPreferencesV2 } from 'utils/lib/fhir/patient';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import { useSuccessQuery } from 'utils/lib/frontend';
import { isPhoneNumberValid } from 'utils/lib/helpers/helpers';
import {
  AppointmentProviderNotificationTypes,
  PROVIDER_NOTIFICATION_PREFERENCES_V2_URL,
  PROVIDER_NOTIFICATION_TYPE_SYSTEM,
  PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL,
  ProviderNotificationMethod,
} from 'utils/lib/types/api/practitioner.types';
import { getAllNotificationRows, ProviderNotificationPreferencesV2 } from 'utils/lib/types/api/provider-notifications';
// FAX_NOTIFICATIONS_DISABLED: FAX_TASK / getTaskInputValue are only needed by getTaskNotificationLink below.
// import { FAX_TASK, getTaskInputValue } from 'utils/lib/types/data/tasks/types';
import { useApiClients } from '../../hooks/useAppClients';
import useEvolveUser from '../../hooks/useEvolveUser';

export type ProviderNotification = {
  appointmentID: string;
  encounter?: Encounter;
  communication: Communication;
  // FAX_NOTIFICATIONS_DISABLED
  // Pre-resolved navigation target for notifications that aren't tied to an appointment
  // (currently inbound-fax notifications, which link to the fax match page).
  // link?: string;
};

/*
 * FAX_NOTIFICATIONS_DISABLED — inbound-fax notifications are temporarily off (the `Communication:based-on`
 * _include below broke the whole bell query). Uncomment this helper, its imports, the `link` field above,
 * the `_include` param and the link resolution in the mapper to bring them back.
 *
 * Destination for a task-backed notification that has no appointment to fall back on. Keyed off the
 * task the notification is `basedOn` rather than the notification type, so it holds for every way a
 * task notification is produced (category subscription, assignment, …).
 *
 * const getTaskNotificationLink = (task: FhirTask | undefined): string | undefined => {
 *   if (task?.groupIdentifier?.value !== FAX_TASK.category) {
 *     return undefined;
 *   }
 *   const faxCommunicationID = getTaskInputValue(task, FAX_TASK.input.communicationId);
 *   return faxCommunicationID ? `/inbound-fax/${faxCommunicationID}/match` : undefined;
 * };
 */

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
            // FAX_NOTIFICATIONS_DISABLED — this include is what took the bell down: it makes the whole
            // search fail, so no notification (fax or not) reaches the bell. Communication.basedOn is
            // Reference(Any), so the untyped form has no resolvable target; the typed
            // `Communication:based-on:Task` form did not fix it either. Find an include the server
            // accepts (or resolve the Task with a second query) before re-enabling.
            // {
            //   // Task notifications have no encounter; their Communication is basedOn the Task, which
            //   // is what `getTaskNotificationLink` needs to resolve a destination (e.g. an inbound fax's
            //   // match page, via the fax Communication id on the Task's input).
            //   name: '_include',
            //   value: 'Communication:based-on',
            // },
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
      // FAX_NOTIFICATIONS_DISABLED
      // const taskResources = notificationResources?.filter(
      //   (resourceTemp: unknown) => (resourceTemp as FhirResource).resourceType === 'Task'
      // ) as FhirTask[];

      return communicationResources.map((communicationResource) => {
        const encounterID = communicationResource.encounter?.reference?.replace('Encounter/', '');
        const encounter = encounterResources.find((encounterTemp) => encounterID === encounterTemp.id);
        const appointmentID = encounter?.appointment?.[0].reference?.replace('Appointment/', '');

        // FAX_NOTIFICATIONS_DISABLED
        // const basedOnTaskID = communicationResource.basedOn
        //   ?.find((ref) => ref.reference?.startsWith('Task/'))
        //   ?.reference?.split('/')?.[1];
        // const link = getTaskNotificationLink(taskResources?.find((taskTemp) => taskTemp.id === basedOnTaskID));

        const notification: ProviderNotification = {
          appointmentID: appointmentID || '',
          encounter,
          communication: communicationResource,
          // link,
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
