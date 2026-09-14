import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { Phrase } from 'utils/lib/fhir/practitioners';
import { getPatchOperationToUpdateExtension } from 'utils/lib/fhir/resourcePatch';
import { PHRASES_EXTENSION_URL } from 'utils/lib/types/constants';
import useEvolveUser, { useUpdatePractitioner } from './useEvolveUser';

const PROFILE_LOADING_MESSAGE = 'Your profile is still loading. Try again in a moment.';

/** Replaces the logged-in user's phrases on their Practitioner, then refreshes the cached profile so usePhrases() re-derives. */
export function useSavePhrases(): UseMutationResult<void, Error, Phrase[]> {
  const user = useEvolveUser();
  const updatePractitioner = useUpdatePractitioner();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['save-phrases'],

    mutationFn: async (phrases: Phrase[]): Promise<void> => {
      const profile = user?.profileResource;
      if (!user || !profile) {
        throw new Error(PROFILE_LOADING_MESSAGE);
      }

      // getPatchOperationToUpdateExtension edits the extension array it is given; work on a copy so a
      // failed save does not leave the cached profile claiming the new phrases.
      const operation = getPatchOperationToUpdateExtension(
        { extension: profile.extension && [...profile.extension] },
        { url: PHRASES_EXTENSION_URL, valueString: JSON.stringify(phrases) }
      );
      if (!operation) return;

      await updatePractitioner.mutateAsync([operation]);
    },

    onSuccess: () => {
      void queryClient.refetchQueries({ queryKey: ['get-practitioner-profile'] });
    },

    onError: (error) => {
      const message =
        error.message === PROFILE_LOADING_MESSAGE ? error.message : 'Could not save phrase. Please try again.';
      enqueueSnackbar(message, { variant: 'error' });
    },
  });
}
