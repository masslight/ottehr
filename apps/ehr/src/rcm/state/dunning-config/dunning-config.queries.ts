import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  DunningConfigResponse,
  getDunningConfig,
  saveDunningConfig,
  SaveDunningConfigInput,
} from './dunning-config.api';

const DUNNING_CONFIG_QUERY_KEY = ['dunning-config'];

export const useGetDunningConfigQuery = (): UseQueryResult<DunningConfigResponse, Error> => {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: DUNNING_CONFIG_QUERY_KEY,
    queryFn: async () => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');
      return getDunningConfig(oystehrZambda);
    },
    enabled: !!oystehrZambda,
  });
};

export const useSaveDunningConfigMutation = (): UseMutationResult<
  DunningConfigResponse,
  Error,
  SaveDunningConfigInput
> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['save-dunning-config'],
    mutationFn: async (data: SaveDunningConfigInput) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');
      return saveDunningConfig(oystehrZambda, data);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(DUNNING_CONFIG_QUERY_KEY, data);
    },
  });
};
