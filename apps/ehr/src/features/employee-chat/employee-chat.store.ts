import { EmployeeChatParticipant } from 'utils/lib/types/api/employee-chat.types';
import { create } from 'zustand';

export type EmployeeChatStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface ChatMessage {
  sid: string;
  index: number;
  mine: boolean;
  body: string;
  dateCreated: string | undefined;
}

export interface ChatListItem {
  sid: string;
  otherEmployee: EmployeeChatParticipant;
  lastMessageIndex?: number;
  lastMessageAt?: string;
  lastReadIndex?: number | null;
  preview?: { body: string; mine: boolean };
}

export interface EmployeeChatState {
  status: EmployeeChatStatus;
  error?: string;
  myProfile?: string;
  drawerOpen: boolean;
  view: 'list' | 'conversation';
  chats: Record<string, ChatListItem>;
  activeSid?: string;
  messages: ChatMessage[];
  loadingMessages: boolean;
  hasOlderMessages: boolean;
  loadingOlder: boolean;
  openingProfile?: string;
  openError?: string;
  unreadEntry?: { id: number; sid: string; dividerIndex?: number };
}

export const initialEmployeeChatState: EmployeeChatState = {
  status: 'idle',
  error: undefined,
  myProfile: undefined,
  drawerOpen: false,
  view: 'list',
  chats: {},
  activeSid: undefined,
  messages: [],
  loadingMessages: false,
  hasOlderMessages: false,
  loadingOlder: false,
  openingProfile: undefined,
  openError: undefined,
  unreadEntry: undefined,
};

export const useEmployeeChatStore = create<EmployeeChatState>()(() => ({ ...initialEmployeeChatState }));
