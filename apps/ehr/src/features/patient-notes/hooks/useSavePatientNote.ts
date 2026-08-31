import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PatientNoteDTO } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { savePatientNote } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';

export const useSavePatientNote = (
  patientId: string | undefined
): ReturnType<typeof useMutation<PatientNoteDTO, Error, PatientNoteDTO>> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (note: PatientNoteDTO): Promise<PatientNoteDTO> => {
      if (!oystehrZambda) throw new Error('API client not available');
      const result = await savePatientNote(oystehrZambda, { note });
      return result.note;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patient-notes', { patientId }] });
    },
  });
};
