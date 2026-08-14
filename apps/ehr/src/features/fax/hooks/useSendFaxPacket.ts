import { useMutation, UseMutationResult } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { SendFaxPacketInput, SendFaxPacketOutput } from 'utils/lib/types/api/fax.types';
import { useOystehrAPIClient } from '../../visits/shared/hooks/useOystehrAPIClient';
import { sendFaxPacket } from '../api/faxApi';

/** Queues the send (creates the Task); the outcome is then polled with `useFaxPacketStatuses`. */
export const useSendFaxPacket = (): UseMutationResult<SendFaxPacketOutput, unknown, SendFaxPacketInput> => {
  const apiClient = useOystehrAPIClient();

  return useMutation({
    mutationFn: (input: SendFaxPacketInput) => {
      if (!apiClient) throw new Error('Fax service is not ready yet. Please try again.');
      return sendFaxPacket(apiClient, input);
    },
    onError: (error) => {
      console.error('Failed to queue fax packet', error);
      enqueueSnackbar(error instanceof Error ? error.message : 'Failed to send fax', { variant: 'error' });
    },
  });
};
