import { useQuery } from '@tanstack/react-query';
import { CPTCodeOption } from 'utils';
import { useOystehrAPIClient } from './useOystehrAPIClient';

export const useEMCodes = (): { emCodes: CPTCodeOption[]; isLoading: boolean } => {
  const apiClient = useOystehrAPIClient();

  const { data, isLoading } = useQuery({
    queryKey: ['em-codes'],
    queryFn: () => apiClient!.getEmCodes(),
    enabled: !!apiClient,
    staleTime: Infinity,
  });

  return { emCodes: data?.codes ?? [], isLoading };
};
