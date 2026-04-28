import { useQuery } from '@tanstack/react-query';
import { getEmCodes } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { EmCodeOption } from 'utils';

export const useEMCodes = (): { emCodes: EmCodeOption[]; isLoading: boolean } => {
  const { oystehrZambda } = useApiClients();

  const { data, isLoading } = useQuery({
    queryKey: ['em-codes'],
    queryFn: async () => {
      if (oystehrZambda) return getEmCodes(oystehrZambda!);
      throw new Error('zambda client not defined');
    },
    enabled: !!oystehrZambda,
    staleTime: Infinity,
  });

  return { emCodes: data?.codes ?? [], isLoading };
};
