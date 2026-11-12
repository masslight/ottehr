import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { GetSupportChatResponse, SendSupportChatMessageInput } from 'utils/lib/types/api/support-chat.types';
import ottehrApi from '../../api/ottehrApi';
import { useUCZambdaClient } from '../../hooks/useUCZambdaClient';

const SUPPORT_CHAT_QUERY_KEY = ['support-chat'];

export const useSupportChatQuery = (
  enabled: boolean,
  refetchInterval: number,
  unreadOnly = false
): UseQueryResult<GetSupportChatResponse, Error> => {
  const zambdaClient = useUCZambdaClient({ tokenless: false });

  return useQuery({
    queryKey: unreadOnly ? [...SUPPORT_CHAT_QUERY_KEY, 'unread'] : SUPPORT_CHAT_QUERY_KEY,
    queryFn: () => ottehrApi.getSupportChat(zambdaClient!, { unreadOnly }),
    enabled: enabled && Boolean(zambdaClient),
    refetchInterval,
    retry: 1,
  });
};

export const useSendSupportChatMessageMutation = (): UseMutationResult<
  GetSupportChatResponse,
  Error,
  SendSupportChatMessageInput
> => {
  const zambdaClient = useUCZambdaClient({ tokenless: false });
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SendSupportChatMessageInput) => ottehrApi.sendSupportChatMessage(zambdaClient!, input),
    onMutate: () => queryClient.cancelQueries({ queryKey: SUPPORT_CHAT_QUERY_KEY, exact: true }),
    onSuccess: (data) => queryClient.setQueryData(SUPPORT_CHAT_QUERY_KEY, data),
  });
};

export const useMarkSupportChatReadMutation = (): UseMutationResult<void, Error, void> => {
  const zambdaClient = useUCZambdaClient({ tokenless: false });
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => ottehrApi.markSupportChatRead(zambdaClient!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SUPPORT_CHAT_QUERY_KEY }),
  });
};
