import { ErxGetConfigurationResponse } from '@oystehr/sdk';
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { useApiClients } from 'src/hooks/useAppClients';
import { useSuccessQuery } from 'utils';

export const useGetErxConfigQuery = (
  onSuccess?: (data: ErxGetConfigurationResponse | null) => void
): UseQueryResult<ErxGetConfigurationResponse, unknown> => {
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
