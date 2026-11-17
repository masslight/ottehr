import { create } from 'zustand';

interface SupportChatState {
  isOpen: boolean;
}

export const useSupportChatStore = create<SupportChatState>()(() => ({ isOpen: false }));

export const openSupportChat = (): void => useSupportChatStore.setState({ isOpen: true });
export const closeSupportChat = (): void => useSupportChatStore.setState({ isOpen: false });
