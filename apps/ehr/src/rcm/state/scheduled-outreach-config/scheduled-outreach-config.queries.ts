import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  getOutreachConfig,
  OutreachConfigResponse,
  saveOutreachConfig,
  SaveOutreachConfigInput,
} from './scheduled-outreach-config.api';

const OUTREACH_CONFIG_QUERY_KEY = ['scheduled-outreach-config'];

export const useGetOutreachConfigQuery = (): UseQueryResult<OutreachConfigResponse, Error> => {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: OUTREACH_CONFIG_QUERY_KEY,
    queryFn: async () => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');
      return getOutreachConfig(oystehrZambda);
    },
    enabled: !!oystehrZambda,
  });
};

export const useSaveOutreachConfigMutation = (): UseMutationResult<
  OutreachConfigResponse,
  Error,
  SaveOutreachConfigInput
> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['save-scheduled-outreach-config'],
    mutationFn: async (data: SaveOutreachConfigInput) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');
      return saveOutreachConfig(oystehrZambda, data);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(OUTREACH_CONFIG_QUERY_KEY, data);
    },
  });
};
