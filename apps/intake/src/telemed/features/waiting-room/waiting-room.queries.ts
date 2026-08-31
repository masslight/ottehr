import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { useAppointmentStore } from 'src/telemed/features/appointments/appointment.store';
import { useOystehrAPIClient } from 'src/telemed/utils/getOystehrAPI';
import { OystehrAPIClient } from 'ui-components/lib/data/oystehrApi';
import { useSuccessQuery } from 'utils/lib/frontend';
import { PromiseReturnType } from 'utils/lib/types/common';
import {
  CancelInviteParticipantRequestParameters,
  InviteParticipantRequestParameters,
} from 'utils/lib/types/data/telemed/video-chat-invites.types';

export const useGetWaitStatus = (
  onSuccess: (data: PromiseReturnType<ReturnType<OystehrAPIClient['getWaitStatus']>> | null) => void,
  appointmentId: string,
  refetchInterval?: number | false,
  enabled?: boolean
): UseQueryResult<PromiseReturnType<ReturnType<OystehrAPIClient['getWaitStatus']>>> => {
  const apiClient = useOystehrAPIClient();
  const queryResult = useQuery({
    queryKey: ['waiting-room', appointmentId, apiClient],

    queryFn: () => {
      if (apiClient && appointmentId) {
        return apiClient.getWaitStatus({ appointmentID: appointmentId });
      }

      throw new Error('api client not defined or appointmentID not provided');
    },

    refetchInterval: refetchInterval ?? 10000,
    enabled: Boolean(apiClient && appointmentId) && (enabled != undefined ? enabled : true),
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};

export const useGetVideoChatInvites = (): UseQueryResult<
  PromiseReturnType<ReturnType<OystehrAPIClient['videoChatListInvites']>>,
  Error
> => {
  const apiClient = useOystehrAPIClient();
  const appointmentID = useAppointmentStore((state) => state.appointmentID);

  return useQuery({
    queryKey: ['video-chat-list-invites', appointmentID, apiClient],

    queryFn: () => {
      if (!apiClient || !appointmentID) {
        throw new Error('Has not passed validation: apiClient or appointmentID is undefined.');
      }
      return apiClient.videoChatListInvites({ appointmentId: appointmentID });
    },

    enabled: Boolean(apiClient && appointmentID),
    staleTime: 60000,
  });
};

export const useCreateInviteMutation = (): UseMutationResult<
  PromiseReturnType<ReturnType<OystehrAPIClient['videoChatCreateInvite']>>,
  Error,
  Omit<InviteParticipantRequestParameters, 'appointmentId'>
> => {
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
