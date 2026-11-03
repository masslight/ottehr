import { FC } from 'react';
import { useSupportChatStatus } from '../hooks/useSupportChatStatus';
import { useSupportChatStore } from '../support-chat.store';
import { SupportChatButton } from './SupportChatButton';
import { SupportChatDialog } from './SupportChatDialog';

export const SupportChatEntry: FC = () => {
  const { isEnabled, hasUnread } = useSupportChatStatus();
  const isOpen = useSupportChatStore((state) => state.isOpen);

  if (!isEnabled) return null;

  return (
    <>
      {isOpen && <SupportChatDialog />}
      <SupportChatButton hasUnread={hasUnread} />
    </>
  );
};
