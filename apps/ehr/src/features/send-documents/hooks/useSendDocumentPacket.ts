import { useMutation, UseMutationResult } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { SendDocumentPacketInput, SendDocumentPacketOutput } from 'utils/lib/types/api/document-packet.types';
import { useOystehrAPIClient } from '../../visits/shared/hooks/useOystehrAPIClient';
import { sendDocumentPacket } from '../api/documentPacketApi';

/** Queues the send (creates the Task); the outcome is then polled with `useDocumentPacketStatuses`. */
export const useSendDocumentPacket = (): UseMutationResult<
  SendDocumentPacketOutput,
  unknown,
  SendDocumentPacketInput
> => {
  const apiClient = useOystehrAPIClient();

  return useMutation({
    mutationFn: (input: SendDocumentPacketInput) => {
      if (!apiClient) throw new Error('Fax service is not ready yet. Please try again.');
      return sendDocumentPacket(apiClient, input);
    },
    onError: (error) => {
      console.error('Failed to queue document packet', error);
      enqueueSnackbar(error instanceof Error ? error.message : 'Failed to send fax', { variant: 'error' });
    },
  });
};
