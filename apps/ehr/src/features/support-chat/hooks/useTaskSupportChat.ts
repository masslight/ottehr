import { enqueueSnackbar } from 'notistack';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SupportChatMessageDto } from 'utils/lib/types/api/support-chat.types';
import { Task } from 'utils/lib/types/data/tasks/types';
import { useCompleteTask } from '../../visits/in-person/hooks/useTasks';
import {
  useMarkTaskSupportChatReadMutation,
  useReplySupportChatMutation,
  useTaskSupportChatQuery,
} from '../support-chat.queries';

export interface UseTaskSupportChat {
  messages: SupportChatMessageDto[];
  firstUnreadId?: string;
  isLoading: boolean;
  isSending: boolean;
  sendReply: (text: string) => Promise<unknown>;
  complete: (text: string) => Promise<void>;
}

export const useTaskSupportChat = (task: Task): UseTaskSupportChat => {
  const { data, isLoading } = useTaskSupportChatQuery(task.id);
  const { mutateAsync: sendReply, isPending: isReplying } = useReplySupportChatMutation(task.id);
  const { mutateAsync: completeTask, isPending: isCompleting } = useCompleteTask();
  const { mutate: markRead } = useMarkTaskSupportChatReadMutation(task.id);
  const [firstUnreadId, setFirstUnreadId] = useState<string>();
  const sentReplyRef = useRef<string>();

  const messages = useMemo(() => data?.messages ?? [], [data]);
  const unreadId = messages.find((message) => message.author === 'patient' && !message.isRead)?.id;

  const isLoaded = data !== undefined;

  useEffect(() => {
    if (!isLoaded || (!unreadId && !task.chat?.hasUnread)) return;
    setFirstUnreadId((current) => current ?? unreadId);
    markRead();
  }, [isLoaded, unreadId, task.chat?.hasUnread, markRead]);

  const complete = async (text: string): Promise<void> => {
    if (text && text !== sentReplyRef.current) {
      await sendReply(text);
      sentReplyRef.current = text;
    }

    try {
      await completeTask({ taskId: task.id });
    } catch (error) {
      enqueueSnackbar('The task was not completed. Please try again.', { variant: 'error' });
      throw error;
    }
  };

  return {
    messages,
    firstUnreadId,
    isLoading,
    isSending: isReplying || isCompleting,
    sendReply,
    complete,
  };
};
