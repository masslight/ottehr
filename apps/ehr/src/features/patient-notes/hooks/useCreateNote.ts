import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { CreateNoteRequest, NoteDTO } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { createNote } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';
import { invalidateNotes, NoteTarget } from './useNotes';

export const useCreateNote = (target: NoteTarget): UseMutationResult<NoteDTO, Error, CreateNoteRequest> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (note: CreateNoteRequest): Promise<NoteDTO> => {
      if (!oystehrZambda) throw new Error('API client not available');
      const result = await createNote(oystehrZambda, { note });
      return result.note;
    },
    onSuccess: () => invalidateNotes(queryClient, target),
  });
};
