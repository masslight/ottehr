import { enqueueSnackbar } from 'notistack';
import { useCallback } from 'react';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import { SendFaxZambdaInput } from 'utils/lib/types/api/send-fax.types';

/**
 * Sends a fax and reports the outcome. Rejects on failure so the calling dialog can stay open with
 * the recipients the user entered.
 */
export const useSendFax = (): ((input: SendFaxZambdaInput) => Promise<void>) => {
  const apiClient = useOystehrAPIClient();

  return useCallback(
    async (input: SendFaxZambdaInput): Promise<void> => {
      if (!apiClient) {
        enqueueSnackbar('Could not initialize the API client. Please try again.', { variant: 'error' });
        throw new Error('api client not defined');
      }

      try {
        const { attemptIds, failureCount } = await apiClient.sendFax(input);
        if (failureCount > 0) {
          enqueueSnackbar(`${attemptIds.length} of ${attemptIds.length + failureCount} faxes sent; the rest failed.`, {
            variant: 'warning',
          });
        } else {
          enqueueSnackbar(attemptIds.length > 1 ? `${attemptIds.length} faxes sent.` : 'Fax sent.', {
            variant: 'success',
          });
        }
      } catch (error) {
        console.error('Error sending fax:', error);
        // Surface a specific server message when provided (e.g. nothing faxable); otherwise a generic one.
        const message = (error as { message?: string })?.message || 'Error sending fax.';
        enqueueSnackbar(message, { variant: 'error' });
        throw error;
      }
    },
    [apiClient]
  );
};
