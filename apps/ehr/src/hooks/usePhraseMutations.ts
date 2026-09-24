import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { Practitioner } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import {
  applyPhraseChange,
  getPhrasesForPractitioner,
  getPhrasesPatchOperation,
  PhraseChange,
} from 'utils/lib/fhir/practitioners';
import { useApiClients } from './useAppClients';
import useEvolveUser, { useUpdatePractitioner } from './useEvolveUser';

const PROFILE_LOADING_MESSAGE = 'Your profile is still loading. Try again in a moment.';
const PHRASE_MISSING_MESSAGE = 'That phrase no longer exists.';
const DUPLICATE_KEY_MESSAGE = 'You already have a phrase with this key.';

const REPORTED_MESSAGES = new Set([PROFILE_LOADING_MESSAGE, PHRASE_MISSING_MESSAGE, DUPLICATE_KEY_MESSAGE]);

export function useSavePhrases(): UseMutationResult<void, Error, PhraseChange> {
  const user = useEvolveUser();
  const { oystehr } = useApiClients();
  const updatePractitioner = useUpdatePractitioner();
  const queryClient = useQueryClient();

  const profileId = user?.profileResource?.id;

  return useMutation({
    mutationKey: ['save-phrases'],

    mutationFn: async (change: PhraseChange): Promise<void> => {
      if (!oystehr || !profileId) {
        throw new Error(PROFILE_LOADING_MESSAGE);
      }

      const practitioner = await oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: profileId });
      const result = applyPhraseChange(getPhrasesForPractitioner(practitioner), change);

      if (!result.ok) {
        throw new Error(result.reason === 'missing' ? PHRASE_MISSING_MESSAGE : DUPLICATE_KEY_MESSAGE);
      }

      await updatePractitioner.mutateAsync({
        operations: [getPhrasesPatchOperation(practitioner, result.phrases)],
      });
    },

    onSuccess: () => {
      void queryClient.refetchQueries({ queryKey: ['get-practitioner-profile'] });
    },

    onError: (error, change) => {
      const fallback =
        change.type === 'delete'
          ? 'Could not delete phrase. Please try again.'
          : 'Could not save phrase. Please try again.';
      enqueueSnackbar(REPORTED_MESSAGES.has(error.message) ? error.message : fallback, { variant: 'error' });
    },
  });
}
