import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { getMedicalRecordDateSpan } from 'src/api/api';
import { MedicalRecordDateSpan } from 'utils/lib/types/data/get-patient-medical-record.types';
import { useApiClients } from './useAppClients';

export const useMedicalRecordDateSpan = (
  patientId: string | undefined,
  enabled: boolean
): UseQueryResult<MedicalRecordDateSpan, Error> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: ['medical-record-date-span', patientId],
    queryFn: () => getMedicalRecordDateSpan(oystehrZambda!, { patientId: patientId! }),
    enabled: enabled && Boolean(patientId) && Boolean(oystehrZambda),
    staleTime: 0,
    retry: 1,
  });
};
