import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { getFlowsheet } from 'src/api/api';
import { GetFlowsheetInput, GetFlowsheetOutput } from 'utils/lib/types/api/flowsheets.types';
import { useApiClients } from './useAppClients';

export const useGetFlowsheet = ({
  patientId,
  flowsheetId,
  asOf,
}: Partial<GetFlowsheetInput>): UseQueryResult<GetFlowsheetOutput, Error> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: ['get-flowsheet', patientId, flowsheetId, asOf],
    queryFn: () => getFlowsheet(oystehrZambda!, { patientId: patientId!, flowsheetId: flowsheetId!, asOf }),
    enabled: Boolean(patientId) && Boolean(flowsheetId) && Boolean(oystehrZambda),
  });
};
