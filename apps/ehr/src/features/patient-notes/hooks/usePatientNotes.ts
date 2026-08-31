import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { PatientNoteDTO } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { getPatientNotes } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';

export const usePatientNotes = (patientId: string | undefined): UseQueryResult<PatientNoteDTO[], Error> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: ['patient-notes', { patientId }],
    queryFn: async (): Promise<PatientNoteDTO[]> => {
      if (!oystehrZambda || !patientId) throw new Error('Missing client or patientId');
      const result = await getPatientNotes(oystehrZambda, { patientId });
      return result.notes;
    },
    enabled: Boolean(patientId) && Boolean(oystehrZambda),
  });
};
