import { useMutation, UseMutationResult } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { SendFaxPacketInput, SendFaxPacketOutput } from 'utils';
import { useOystehrAPIClient } from '../../visits/shared/hooks/useOystehrAPIClient';
import { sendFaxPacket } from '../api/faxApi';

/** Queues the send (creates the Task); the outcome is then polled with `useFaxPacketStatuses`. */
export const useSendFaxPacket = (): UseMutationResult<SendFaxPacketOutput, unknown, SendFaxPacketInput> => {
  const apiClient = useOystehrAPIClient();

  return useMutation({
    mutationFn: (input: SendFaxPacketInput) => sendFaxPacket(apiClient!, input),
    onError: (error) => {
      console.error('Failed to queue fax packet', error);
      enqueueSnackbar(error instanceof Error ? error.message : 'Failed to send fax', { variant: 'error' });
    },
  });
};
