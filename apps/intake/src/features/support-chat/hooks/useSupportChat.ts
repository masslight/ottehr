import { useEffect, useMemo, useState } from 'react';
import { SupportChatMessageDto, SupportChatTopic } from 'utils/lib/types/api/support-chat.types';
import {
  useMarkSupportChatReadMutation,
  useSendSupportChatMessageMutation,
  useSupportChatQuery,
} from '../support-chat.queries';

const OPEN_REFETCH_INTERVAL_MS = 10_000;

export interface UseSupportChat {
  messages: SupportChatMessageDto[];
  activePromptId?: string;
  firstUnreadId?: string;
  isLoading: boolean;
  isSending: boolean;
  hasSendError: boolean;
  selectOption: (messageId: string, optionId: string) => void;
  sendText: (text: string) => Promise<unknown>;
  startNewRequest: () => void;
}

export const useSupportChat = (): UseSupportChat => {
  const { data, isLoading } = useSupportChatQuery(true, OPEN_REFETCH_INTERVAL_MS);
  const {
    mutate: send,
    mutateAsync: sendAsync,
    isPending: isSending,
    isError: hasSendError,
  } = useSendSupportChatMessageMutation();
  const { mutate: markRead } = useMarkSupportChatReadMutation();
  const [firstUnreadId, setFirstUnreadId] = useState<string>();

  const messages = useMemo(() => data?.messages ?? [], [data]);
  const lastMessage = messages.at(-1);

  const activePromptId =
    lastMessage?.kind === 'greeting' || lastMessage?.kind === 'visit-prompt' ? lastMessage.id : undefined;

  const unreadId = messages.find((message) => message.author !== 'patient' && !message.isRead)?.id;

  useEffect(() => {
    if (!unreadId) return;

    setFirstUnreadId((current) => current ?? unreadId);
    markRead();
  }, [unreadId, markRead]);

  const selectOption = (messageId: string, optionId: string): void => {
    if (isSending) return;

    const message = messages.find((m) => m.id === messageId);

    if (message?.kind === 'greeting') send({ action: 'select-topic', topic: optionId as SupportChatTopic });
    if (message?.kind === 'visit-prompt') send({ action: 'select-visit', appointmentId: optionId });
  };

  return {
    messages,
    activePromptId: isSending ? undefined : activePromptId,
    firstUnreadId,
    isLoading,
    isSending,
    hasSendError,
    selectOption,
    sendText: (text) => sendAsync({ action: 'text', text }),
    startNewRequest: () => {
      if (!isSending) send({ action: 'new-request' });
    },
  };
};
