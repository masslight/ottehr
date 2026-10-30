import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { NoteDTO, UpdateNoteRequest } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { updateNote } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';
import { invalidateNotes, NoteTarget } from './useNotes';

export const useUpdateNote = (target: NoteTarget): UseMutationResult<NoteDTO, Error, UpdateNoteRequest> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (note: UpdateNoteRequest): Promise<NoteDTO> => {
      if (!oystehrZambda) throw new Error('API client not available');
      const result = await updateNote(oystehrZambda, { note });
      return result.note;
    },
    onSuccess: () => invalidateNotes(queryClient, target),
  });
};
