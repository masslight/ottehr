import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { getPatientNotesCount } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';

export const usePatientNotesCount = (patientId: string | undefined): UseQueryResult<number, Error> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: ['patient-notes-count', { patientId }],
    queryFn: async (): Promise<number> => {
      if (!oystehrZambda || !patientId) throw new Error('Missing client or patientId');
      const result = await getPatientNotesCount(oystehrZambda, { patientId });
      return result.count;
    },
    enabled: Boolean(patientId) && Boolean(oystehrZambda),
  });
};
