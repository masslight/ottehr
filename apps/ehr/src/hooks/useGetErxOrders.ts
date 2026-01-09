import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { chooseJson, GetErxOrdersInput, GetErxOrdersResponse } from 'utils';
import { useApiClients } from './useAppClients';

export const useGetErxOrders = (input: GetErxOrdersInput): UseQueryResult<GetErxOrdersResponse, Error> => {
  const { oystehrZambda } = useApiClients();
  const encounterIdsHasLen = input.encounterIds && input.encounterIds.length > 0;
  return useQuery({
    queryKey: ['get-erx-orders', JSON.stringify(input)],
    queryFn: async () => {
      if (!oystehrZambda) throw new Error('oystehrZambda not defined');
      const response = await oystehrZambda.zambda.execute({
        ...input,
        id: 'get-erx-orders',
      });
      return chooseJson(response);
    },
    enabled: oystehrZambda && encounterIdsHasLen,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};
