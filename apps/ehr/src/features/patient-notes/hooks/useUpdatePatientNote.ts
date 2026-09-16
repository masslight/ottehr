import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { UpdatePatientNoteRequest } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { PatientNoteDTO, updatePatientNote } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';

export const useUpdatePatientNote = (
  patientId: string | undefined
): UseMutationResult<PatientNoteDTO, Error, UpdatePatientNoteRequest> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (note: UpdatePatientNoteRequest): Promise<PatientNoteDTO> => {
      if (!oystehrZambda) throw new Error('API client not available');
      const result = await updatePatientNote(oystehrZambda, { note });
      return result.note;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patient-notes', { patientId }] });
    },
  });
};
