import { useQuery } from '@tanstack/react-query';
import { useApiClients } from 'src/hooks/useAppClients';
import { useSuccessQuery } from 'utils';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetErxConfigQuery = (onSuccess?: (data: any) => void) => {
  const { oystehr } = useApiClients();
  const queryResult = useQuery({
    queryKey: ['erx-config'],
    queryFn: async () => {
      if (!oystehr) {
        throw new Error('API client not available');
      }

      return await oystehr.erx.getConfiguration();
    },
    enabled: !!oystehr,
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};
