import { ErxGetConfigurationResponse } from '@oystehr/sdk';
import { useQuery, UseQueryResult } from 'react-query';
import { useApiClients } from 'src/hooks/useAppClients';

export const useGetErxConfigQuery = (
  onSuccess?: (data: ErxGetConfigurationResponse) => void
): UseQueryResult<ErxGetConfigurationResponse, unknown> => {
  const { oystehr } = useApiClients();
  return useQuery(
    'erx-config',
    async () => {
      if (!oystehr) {
        throw new Error('API client not available');
      }

      return await oystehr.erx.getConfiguration();
    },
    {
      onSuccess,
      enabled: !!oystehr,
    }
  );
};
