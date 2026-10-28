import { useQuery, UseQueryResult } from '@tanstack/react-query';
import type { Observation } from 'fhir/r4b';
import { getGrowthChartData } from 'src/api/api';
import { QUERY_STALE_TIME } from 'src/constants';
import { useApiClients } from 'src/hooks/useAppClients';

// Every weight and height ever recorded for the patient, across all visits (get-growth-chart-data).
export const useGrowthObservations = (patientId: string | undefined): UseQueryResult<Observation[], Error> => {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: ['growth-chart-observations', patientId],
    enabled: !!oystehrZambda && !!patientId,
    staleTime: QUERY_STALE_TIME,
    queryFn: async () => {
      if (!oystehrZambda || !patientId) throw new Error('oystehrZambda or patient not defined');
      return (await getGrowthChartData(oystehrZambda, { patientId })).observations;
    },
  });
};
