import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { Task } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { GetSupportChatResponse, SUPPORT_CHAT_UNREAD_TAG } from 'utils/lib/types/api/support-chat.types';
import { getSupportChat, markSupportChatRead, replySupportChat } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import { GET_TASKS_KEY } from '../visits/in-person/hooks/useTasks';

const REFETCH_INTERVAL_MS = 10_000;
const UNREAD_REFETCH_INTERVAL_MS = 30_000;

const supportChatKey = (taskId: string): string[] => ['support-chat', taskId];

export const useTaskSupportChatQuery = (taskId: string): UseQueryResult<GetSupportChatResponse, Error> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: supportChatKey(taskId),
    queryFn: () => getSupportChat(oystehrZambda!, taskId),
    enabled: Boolean(oystehrZambda),
    refetchInterval: REFETCH_INTERVAL_MS,
  });
};

export const useHasUnreadSupportChatsQuery = (enabled: boolean): boolean => {
  const { oystehr } = useApiClients();

  const { data } = useQuery({
    queryKey: [GET_TASKS_KEY, 'support-chat-unread'],
    queryFn: async () => {
      const tasks = await oystehr!.fhir.search<Task>({
        resourceType: 'Task',
        params: [
          { name: '_tag', value: `${SUPPORT_CHAT_UNREAD_TAG.system}|${SUPPORT_CHAT_UNREAD_TAG.code}` },
          { name: 'status', value: 'ready,in-progress' },
          { name: '_count', value: 1 },
        ],
      });
      return tasks.unbundle().length > 0;
    },
    enabled: enabled && Boolean(oystehr),
    refetchInterval: UNREAD_REFETCH_INTERVAL_MS,
  });

  return Boolean(data);
};

export const useReplySupportChatMutation = (
  taskId: string
): UseMutationResult<GetSupportChatResponse, Error, string> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (text: string) => replySupportChat(oystehrZambda!, { taskId, text }),
    onMutate: () => queryClient.cancelQueries({ queryKey: supportChatKey(taskId) }),
    onSuccess: (data) => queryClient.setQueryData(supportChatKey(taskId), data),
    onError: () => enqueueSnackbar('The message was not sent. Please try again.', { variant: 'error' }),
  });
};

export const useMarkTaskSupportChatReadMutation = (taskId: string): UseMutationResult<void, Error, void> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => markSupportChatRead(oystehrZambda!, { taskId }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: supportChatKey(taskId) }),
        queryClient.invalidateQueries({ queryKey: [GET_TASKS_KEY] }),
      ]);
    },
  });
};
