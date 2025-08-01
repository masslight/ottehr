import { useQuery } from 'react-query';
import { useApiClients } from 'src/hooks/useAppClients';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetErxConfigQuery = (onSuccess?: (data: any) => void) => {
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
