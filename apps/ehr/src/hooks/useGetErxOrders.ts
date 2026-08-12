import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { chooseJson } from 'utils/lib/helpers/oystehrApi';
import { GetErxOrdersInput, GetErxOrdersResponse } from 'utils/lib/types/api/erx.types';
import { useApiClients } from './useAppClients';

export const useGetErxOrders = (input: GetErxOrdersInput): UseQueryResult<GetErxOrdersResponse | null, Error> => {
  const { oystehrZambda } = useApiClients();
  const encounterIdsHasLen = input.encounterIds && input.encounterIds.length > 0;
  return useQuery({
    queryKey: ['get-erx-orders', JSON.stringify(input)],
    queryFn: async () => {
      if (!oystehrZambda) throw new Error('oystehrZambda not defined');
      if (encounterIdsHasLen) {
        const response = await oystehrZambda.zambda.execute({
          encounterIds: input.encounterIds,
          id: 'get-erx-orders',
        });
        return chooseJson(response);
      } else {
        return null;
      }
    },
    enabled: oystehrZambda && encounterIdsHasLen,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};
