import { Operation } from 'fast-json-patch';
import { Communication, Encounter, Extension } from 'fhir/r4b';
import { useMutation, useQuery } from 'react-query';
import {
  AppointmentProviderNotificationTypes,
  getPatchBinary,
  PROVIDER_NOTIFICATION_METHOD_URL,
  PROVIDER_NOTIFICATION_TYPE_SYSTEM,
  PROVIDER_NOTIFICATIONS_ENABLED_URL,
  PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL,
  ProviderNotificationMethod,
} from 'utils';
import { useApiClients } from '../../hooks/useAppClients';
import useEvolveUser from '../../hooks/useEvolveUser';

export type ProviderNotification = {
  appointmentID: string;
  encounter?: Encounter;
  communication: Communication;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetProviderNotifications = (onSuccess?: (data: ProviderNotification[]) => void) => {
  const { oystehr } = useApiClients();
  const user = useEvolveUser();
  return useQuery(
    ['provider-notifications'],
    async () => {
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
              value: `${PROVIDER_NOTIFICATION_TYPE_SYSTEM}|${[
                AppointmentProviderNotificationTypes.patient_waiting,
                AppointmentProviderNotificationTypes.unsigned_charts,
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
        (resourceTemp) => resourceTemp.resourceType === 'Communication'
      ) as Communication[];
      const encounterResources = notificationResources?.filter(
        (resourceTemp) => resourceTemp.resourceType === 'Encounter'
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
    { enabled: !!(oystehr && user?.profile), refetchInterval: 10000, refetchIntervalInBackground: true, onSuccess }
  );
};

interface UpdateProviderNotificationsParams {
  method: ProviderNotificationMethod;
  enabled: boolean;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useUpdateProviderNotificationSettingsMutation = (
  onSuccess: (params: UpdateProviderNotificationsParams) => void
) => {
  const user = useEvolveUser();
  const { oystehr } = useApiClients();
  return useMutation(
    ['provider-notifications'],
    async ({ method, enabled }: UpdateProviderNotificationsParams) => {
      if (!user?.profileResource) throw new Error('User practitioner profile not defined');

      const notificationsExtIndex = (user.profileResource.extension || [])?.findIndex(
        (ext) => ext.url === PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL
      );

      const newNotificationSettingsExtension: Extension[] = [
        {
          url: PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL,
          extension: [
            {
              url: PROVIDER_NOTIFICATION_METHOD_URL,
              valueString: method,
            },
            {
              url: PROVIDER_NOTIFICATIONS_ENABLED_URL,
              valueBoolean: enabled,
            },
          ],
        },
      ];

      let patchOp: Operation;

      if (!user.profileResource.extension) {
        patchOp = {
          op: 'add',
          path: `/extension`,
          value: newNotificationSettingsExtension,
        };
      } else {
        patchOp = {
          op: notificationsExtIndex >= 0 ? 'replace' : 'add',
          path: `/extension/${notificationsExtIndex >= 0 ? notificationsExtIndex : '-'}`,
          value: newNotificationSettingsExtension[0],
        };
      }

      await oystehr?.fhir.patch({
        id: user.profileResource.id ?? '',
        resourceType: 'Practitioner',
        operations: [patchOp],
      });
      return { method, enabled };
    },
    { onSuccess }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useUpdateProviderNotificationsMutation = (onSuccess?: () => void) => {
  const { oystehr } = useApiClients();
  return useMutation(
    ['provider-notifications'],
    async (params: { ids: NonNullable<Communication['id']>[]; status: Communication['status'] }) => {
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
    { onSuccess }
  );
};
