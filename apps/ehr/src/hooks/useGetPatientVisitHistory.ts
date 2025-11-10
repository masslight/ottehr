import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { PatientVisitListResponse } from 'utils';
import { useApiClients } from './useAppClients';

export const useGetPatientVisitHistory = (
  patientId: string | undefined
): UseQueryResult<PatientVisitListResponse, Error> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: [`get-patient-visit-history`, { patientId: patientId }],
    queryFn: async (): Promise<PatientVisitListResponse> => {
      if (oystehrZambda && patientId) {
        const result = await oystehrZambda.zambda.execute({
          id: 'get-patient-visit-history',
          patientId: patientId,
        });
        return result.output as PatientVisitListResponse;
      }

      throw new Error('api client not defined or patient id is not provided');
    },
    enabled: Boolean(patientId) && Boolean(oystehrZambda),
  });
};
