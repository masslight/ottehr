import Oystehr from '@oystehr/sdk';
import { useQuery } from 'react-query';
import { useApiClients } from 'src/hooks/useAppClients';

export const useGetErxConfigQuery = (
  onSuccess?: (data: Awaited<ReturnType<typeof Oystehr.prototype.erx.getConfiguration>>) => void
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
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
