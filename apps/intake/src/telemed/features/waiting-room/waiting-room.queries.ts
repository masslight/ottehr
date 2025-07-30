import { useMutation, useQuery, useQueryClient } from 'react-query';
import { OystehrAPIClient } from 'ui-components';
import { CancelInviteParticipantRequestParameters, InviteParticipantRequestParameters, PromiseReturnType } from 'utils';
import { useOystehrAPIClient } from '../../utils';
import { useAppointmentStore } from '../appointments';

export const useGetWaitStatus = (
  onSuccess: (data: PromiseReturnType<ReturnType<OystehrAPIClient['getWaitStatus']>>) => void,
  appointmentId: string,
  refetchInterval?: number | false,
  enabled?: boolean
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
  const apiClient = useOystehrAPIClient();
  return useQuery(
    ['waiting-room', appointmentId, apiClient],
    () => {
      if (apiClient && appointmentId) {
        return apiClient.getWaitStatus({ appointmentID: appointmentId });
      }

      throw new Error('api client not defined or appointmentID not provided');
    },
    {
      refetchInterval: refetchInterval ?? 10000,
      enabled: Boolean(apiClient && appointmentId) && (enabled != undefined ? enabled : true),
      onSuccess,
      onError: (err) => {
        console.error('Error during fetching get waiting room: ', err);
      },
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetVideoChatInvites = () => {
  const apiClient = useOystehrAPIClient();
  const appointmentID = useAppointmentStore((state) => state.appointmentID);

  return useQuery(
    ['video-chat-list-invites', appointmentID, apiClient],
    () => {
      if (!apiClient || !appointmentID) {
        throw new Error('Has not passed validation: apiClient or appointmentID is undefined.');
      }
      return apiClient.videoChatListInvites({ appointmentId: appointmentID });
    },
    {
      enabled: Boolean(apiClient && appointmentID),
      staleTime: 60000,
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useCreateInviteMutation = () => {
  const apiClient = useOystehrAPIClient();
  const { appointmentID } = useAppointmentStore.getState();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (partialParams: Omit<InviteParticipantRequestParameters, 'appointmentId'>) => {
      if (!apiClient || !appointmentID) {
        throw new Error('Has not passed validation: apiClient or appointmentID is undefined.');
      }
      const params = { ...{ appointmentId: appointmentID }, ...partialParams };
      return apiClient.videoChatCreateInvite(params);
    },
    onSuccess: () => {
      void queryClient.refetchQueries({
        queryKey: ['video-chat-list-invites'],
      });
    },
  });
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useCancelInviteMutation = () => {
  const apiClient = useOystehrAPIClient();
  const { appointmentID } = useAppointmentStore.getState();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (partialParams: Omit<CancelInviteParticipantRequestParameters, 'appointmentId'>) => {
      if (!apiClient || !appointmentID) {
        throw new Error('Has not passed validation: apiClient or appointmentID is undefined.');
      }
      const params = { ...{ appointmentId: appointmentID }, ...partialParams };
      return apiClient.videoChatCancelInvite(params);
    },
    onSuccess: () => {
      void queryClient.refetchQueries({
        queryKey: ['video-chat-list-invites'],
      });
    },
  });
};
