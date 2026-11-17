import { useAuth0 } from '@auth0/auth0-react';
import { FEATURE_FLAGS_CONFIG } from 'utils/lib/ottehr-config/feature-flags';
import { useSupportChatQuery } from '../support-chat.queries';
import { useSupportChatStore } from '../support-chat.store';

const CLOSED_REFETCH_INTERVAL_MS = 30_000;

export const useSupportChatStatus = (): { isLoading: boolean; isEnabled: boolean; hasUnread: boolean } => {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth0();
  const isOpen = useSupportChatStore((state) => state.isOpen);
  const canUseChat = isAuthenticated && Boolean(FEATURE_FLAGS_CONFIG.supportChatEnabled);
  const { data, isPending } = useSupportChatQuery(canUseChat, CLOSED_REFETCH_INTERVAL_MS, true);

  return {
    isLoading: isAuthLoading || (canUseChat && isPending),
    isEnabled: canUseChat && Boolean(data?.isAvailable),
    hasUnread: !isOpen && Boolean(data?.unreadCount),
  };
};
