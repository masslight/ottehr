import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { PatientNoteDTO, UpdatePatientNoteRequest } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { updatePatientNote } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';
import { invalidateNotes } from './usePatientNotes';

export const useUpdatePatientNote = (): UseMutationResult<PatientNoteDTO, Error, UpdatePatientNoteRequest> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (note: UpdatePatientNoteRequest): Promise<PatientNoteDTO> => {
      if (!oystehrZambda) throw new Error('API client not available');
      const result = await updatePatientNote(oystehrZambda, { note });
      return result.note;
    },
    onSuccess: () => invalidateNotes(queryClient),
  });
};
