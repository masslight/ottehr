import { useMutation, useQuery, useQueryClient } from 'react-query';
import { ZapEHRAPIClient } from 'ottehr-components';
import { CancelInviteParticipantRequestParameters, InviteParticipantRequestParameters, PromiseReturnType } from 'ottehr-utils';
import { useZapEHRAPIClient } from '../../utils';
import { useAppointmentStore } from '../appointments';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetWaitStatus = (
  onSuccess: (data: PromiseReturnType<ReturnType<ZapEHRAPIClient['getWaitStatus']>>) => void
) => {
  const apiClient = useZapEHRAPIClient();
  const appointmentID = useAppointmentStore((state) => state.appointmentID);
  return useQuery(
    ['waiting-room'],
    () => {
      if (apiClient && appointmentID) {
        return apiClient.getWaitStatus({ appointmentID: appointmentID });
      }

      throw new Error('api client not defined or appointmentID not provided');
    },
    {
      refetchInterval: 10000,
      enabled: Boolean(apiClient && appointmentID),
      onSuccess,
      onError: (err) => {
        console.error('Error during fetching get waiting room: ', err);
      },
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetVideoChatInvites = () => {
  const apiClient = useZapEHRAPIClient();
  const appointmentID = useAppointmentStore((state) => state.appointmentID);

  return useQuery(
    ['video-chat-list-invites', appointmentID],
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
  const apiClient = useZapEHRAPIClient();
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
  const apiClient = useZapEHRAPIClient();
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
