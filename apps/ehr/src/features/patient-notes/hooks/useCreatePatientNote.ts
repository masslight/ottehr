import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { CreatePatientNoteRequest, PatientNoteDTO } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { createPatientNote } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';
import { invalidateNotes } from './usePatientNotes';

export const useCreatePatientNote = (): UseMutationResult<PatientNoteDTO, Error, CreatePatientNoteRequest> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (note: CreatePatientNoteRequest): Promise<PatientNoteDTO> => {
      if (!oystehrZambda) throw new Error('API client not available');
      const result = await createPatientNote(oystehrZambda, { note });
      return result.note;
    },
    onSuccess: () => invalidateNotes(queryClient),
  });
};
