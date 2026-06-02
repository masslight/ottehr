import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { GetProgressNoteConfigOutput, UpdateProgressNoteConfigInput } from 'utils';
import { safelyCaptureException } from 'utils/lib/frontend/sentry';
import { adminUpdateProgressNoteConfig, getProgressNoteConfig } from '../api/api';
import { useApiClients } from './useAppClients';

const PROGRESS_NOTE_CONFIG_QUERY_KEY = 'progress-note-config';

export function useProgressNoteConfig(): UseQueryResult<GetProgressNoteConfigOutput, Error> {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: [PROGRESS_NOTE_CONFIG_QUERY_KEY],
    queryFn: () => getProgressNoteConfig(oystehrZambda!),
    enabled: !!oystehrZambda,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateProgressNoteConfig(): UseMutationResult<void, Error, UpdateProgressNoteConfigInput> {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['admin-update-progress-note-config'],
    mutationFn: async (input: UpdateProgressNoteConfigInput) => {
      if (!oystehrZambda) {
        throw new Error('oystehr client is undefined');
      }
      await adminUpdateProgressNoteConfig(oystehrZambda, input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [PROGRESS_NOTE_CONFIG_QUERY_KEY],
      });
      enqueueSnackbar('Progress note settings updated', {
        variant: 'success',
      });
    },
    onError: (error: Error) => {
      safelyCaptureException(error);
      enqueueSnackbar('Failed to update progress note settings.', {
        variant: 'error',
      });
    },
  });
}
