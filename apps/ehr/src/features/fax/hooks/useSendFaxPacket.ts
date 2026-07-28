import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { SendFaxPacketInput, SendFaxPacketOutput } from 'utils';
import { useOystehrAPIClient } from '../../visits/shared/hooks/useOystehrAPIClient';
import { sendFaxPacket } from '../api/faxApi';

export const failedResults = (output: SendFaxPacketOutput): SendFaxPacketOutput['results'] =>
  output.results.filter((result) => result.status === 'failed');

export const useSendFaxPacket = (
  appointmentId: string | undefined
): UseMutationResult<SendFaxPacketOutput, unknown, SendFaxPacketInput> => {
  const apiClient = useOystehrAPIClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SendFaxPacketInput) => sendFaxPacket(apiClient!, input),
    onSuccess: (output) => {
      const failed = failedResults(output);

      if (failed.length === 0) {
        const count = output.results.length;
        enqueueSnackbar(`Fax sent to ${count} recipient${count === 1 ? '' : 's'}`, { variant: 'success' });
      }

      if (output.pcpSaveError) {
        enqueueSnackbar('Fax sent, but the recipient could not be saved as the patient PCP', {
          variant: 'warning',
        });
      }
      void queryClient.invalidateQueries({ queryKey: ['get-visit-fax-history', appointmentId] });
    },
    onError: (error) => {
      console.error('Failed to send fax packet', error);
      enqueueSnackbar(error instanceof Error ? error.message : 'Failed to send fax', { variant: 'error' });
    },
  });
};
