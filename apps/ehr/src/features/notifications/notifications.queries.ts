import { useMutation, UseMutationResult, useQuery, UseQueryResult } from '@tanstack/react-query';
import { Operation } from 'fast-json-patch';
import { Communication, Encounter, Extension, FhirResource, Task as FhirTask } from 'fhir/r4b';
import {
  AppointmentProviderNotificationTypes,
  FAX_TASK,
  getPatchBinary,
  getProviderNotificationSettingsForPractitioner,
  getTaskInputValue,
  isPhoneNumberValid,
  PROVIDER_NOTIFICATION_METHOD_URL,
  PROVIDER_NOTIFICATION_TYPE_SYSTEM,
  PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL,
  PROVIDER_TASK_NOTIFICATIONS_ENABLED_URL,
  PROVIDER_TELEMED_NOTIFICATIONS_ENABLED_URL,
  ProviderNotificationMethod,
} from 'utils';
import { useSuccessQuery } from 'utils/lib/frontend';
import { useApiClients } from '../../hooks/useAppClients';
import useEvolveUser from '../../hooks/useEvolveUser';

export type ProviderNotification = {
  appointmentID: string;
  encounter?: Encounter;
  communication: Communication;
  // Pre-resolved navigation target for notifications that aren't tied to an appointment
  // (currently inbound-fax notifications, which link to the fax match page).
  link?: string;
};

const isInboundFaxNotification = (communication: Communication): boolean =>
  !!communication.category?.some(
    (category) =>
      category.coding?.some(
        (coding) =>
          coding.system === PROVIDER_NOTIFICATION_TYPE_SYSTEM &&
          coding.code === AppointmentProviderNotificationTypes.inbound_fax
      )
  );

export const useGetProviderNotifications = (
  onSuccess?: (data: ProviderNotification[] | null) => void
): UseQueryResult<ProviderNotification[], Error> => {
  const { oystehr } = useApiClients();
  const user = useEvolveUser();
  const isPhoneOnly =
    getProviderNotificationSettingsForPractitioner(user?.profileResource)?.method === ProviderNotificationMethod.phone;
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
              // Inbound-fax notifications have no encounter; their Communication is basedOn the
              // fax Task, whose input carries the fax Communication id used to build the match link.
              name: '_include',
              value: 'Communication:based-on',
            },
            {
              name: 'recipient',
              value: user!.profile,
            },
            {
              name: 'category',
              value: `${PROVIDER_NOTIFICATION_TYPE_SYSTEM}|${[
                AppointmentProviderNotificationTypes.patient_waiting,
                AppointmentProviderNotificationTypes.unsigned_charts,
                AppointmentProviderNotificationTypes.task_assigned,
                AppointmentProviderNotificationTypes.inbound_fax,
              ].join(',')}`,
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
      const taskResources = notificationResources?.filter(
        (resourceTemp: unknown) => (resourceTemp as FhirResource).resourceType === 'Task'
      ) as FhirTask[];

      return communicationResources.map((communicationResource) => {
        const encounterID = communicationResource.encounter?.reference?.replace('Encounter/', '');
        const encounter = encounterResources.find((encounterTemp) => encounterID === encounterTemp.id);
        const appointmentID = encounter?.appointment?.[0].reference?.replace('Appointment/', '');

        let link: string | undefined;
        if (isInboundFaxNotification(communicationResource)) {
          const taskID = communicationResource.basedOn
            ?.find((ref) => ref.reference?.startsWith('Task/'))
            ?.reference?.split('/')?.[1];
          const task = taskResources?.find((taskTemp) => taskTemp.id === taskID);
          const faxCommunicationID = task ? getTaskInputValue(task, FAX_TASK.input.communicationId) : undefined;
          if (faxCommunicationID) {
            link = `/inbound-fax/${faxCommunicationID}/match`;
          }
        }

        const notification: ProviderNotification = {
          appointmentID: appointmentID || '',
          encounter,
          communication: communicationResource,
          link,
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

interface UpdateProviderNotificationsParams {
  method: ProviderNotificationMethod;
  taskNotificationsEnabled: boolean;
  telemedNotificationsEnabled: boolean;
  phoneNumber?: string;
}

export const useUpdateProviderNotificationSettingsMutation = (
  onSuccess: (params: UpdateProviderNotificationsParams) => void
): UseMutationResult<UpdateProviderNotificationsParams, Error, UpdateProviderNotificationsParams> => {
  const user = useEvolveUser();
  const { oystehr } = useApiClients();
  return useMutation({
    mutationKey: ['provider-notifications'],

    mutationFn: async ({
      method,
      taskNotificationsEnabled,
      telemedNotificationsEnabled,
      phoneNumber,
    }: UpdateProviderNotificationsParams) => {
      if (!user?.profileResource) throw new Error('User practitioner profile not defined');

      const notificationsExtIndex = (user.profileResource.extension || [])?.findIndex(
        (ext) => ext.url === PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL
      );

      const newNotificationSettingsExtension: Extension[] = [
        {
          url: PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL,
          extension: [
            { url: PROVIDER_NOTIFICATION_METHOD_URL, valueString: method },
            { url: PROVIDER_TASK_NOTIFICATIONS_ENABLED_URL, valueBoolean: taskNotificationsEnabled },
            { url: PROVIDER_TELEMED_NOTIFICATIONS_ENABLED_URL, valueBoolean: telemedNotificationsEnabled },
          ],
        },
      ];

      const operations: Operation[] = [];

      if (!user.profileResource.extension) {
        operations.push({ op: 'add', path: '/extension', value: newNotificationSettingsExtension });
      } else {
        operations.push({
          op: notificationsExtIndex >= 0 ? 'replace' : 'add',
          path: `/extension/${notificationsExtIndex >= 0 ? notificationsExtIndex : '-'}`,
          value: newNotificationSettingsExtension[0],
        });
      }

      const isValidPhoneNumber = isPhoneNumberValid(phoneNumber);
      if (
        [ProviderNotificationMethod['phone'], ProviderNotificationMethod['phone and computer']].includes(method) &&
        isValidPhoneNumber
      ) {
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
      return { method, taskNotificationsEnabled, telemedNotificationsEnabled, phoneNumber };
    },

    onSuccess,
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
