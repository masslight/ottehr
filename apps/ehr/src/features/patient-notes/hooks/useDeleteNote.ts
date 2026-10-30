import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { deleteNote } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';
import { invalidateNotes, NoteTarget } from './useNotes';

export const useDeleteNote = (target: NoteTarget): UseMutationResult<void, Error, string> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (resourceId: string): Promise<void> => {
      if (!oystehrZambda) throw new Error('API client not available');
      await deleteNote(oystehrZambda, { resourceId });
    },
    onSuccess: () => invalidateNotes(queryClient, target),
  });
};
