import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { CreatePatientNoteRequest } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { PatientNoteDTO } from '../../../api/api';
import { createPatientNote } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';

export const useCreatePatientNote = (
  patientId: string | undefined
): UseMutationResult<PatientNoteDTO, Error, CreatePatientNoteRequest> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (note: CreatePatientNoteRequest): Promise<PatientNoteDTO> => {
      if (!oystehrZambda) throw new Error('API client not available');
      const result = await createPatientNote(oystehrZambda, { note });
      return result.note;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patient-notes', { patientId }] });
      void queryClient.invalidateQueries({ queryKey: ['patient-notes-count', { patientId }] });
    },
  });
};
