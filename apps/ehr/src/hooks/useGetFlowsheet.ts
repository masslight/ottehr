import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { getFlowsheet } from 'src/api/api';
import { GetFlowsheetInput, GetFlowsheetOutput } from 'utils/lib/types/api/flowsheets.types';
import { useApiClients } from './useAppClients';

export const useGetFlowsheet = (input: GetFlowsheetInput): UseQueryResult<GetFlowsheetOutput, Error> => {
  const { oystehrZambda } = useApiClients();
  const { patientId, flowsheetId, currentEncounterId } = input;

  return useQuery({
    queryKey: ['get-flowsheet', patientId, flowsheetId, currentEncounterId],
    queryFn: () => getFlowsheet(oystehrZambda!, input),
    enabled: Boolean(oystehrZambda),
  });
};
