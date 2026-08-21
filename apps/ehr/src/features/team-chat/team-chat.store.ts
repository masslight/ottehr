import { create } from 'zustand';

export type TeamChatConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface TeamChatMention {
  // Practitioner relative reference, e.g. 'Practitioner/<uuid>'
  profile: string;
  name: string;
}

// Attributes attached to each Twilio message. The Twilio identity of a sender is
// an opaque Oystehr identifier, so messages carry their own display metadata.
export interface TeamChatMessageAttributes {
  senderName?: string;
  senderProfile?: string;
  mentions?: TeamChatMention[];
}

// Plain DTO mirrored from the Twilio Message class so components and tests never
// need the Twilio SDK types.
export interface TeamChatMessage {
  sid: string;
  index: number;
  author: string;
  body: string;
  dateCreated: string | undefined;
  attributes: TeamChatMessageAttributes;
}

interface TeamChatState {
  status: TeamChatConnectionStatus;
  error?: string;
  identity?: string;
  myProfile?: string;
  messages: TeamChatMessage[];
  unreadCount: number;
  hasUnseenMention: boolean;
  drawerOpen: boolean;
  hasOlderMessages: boolean;
  loadingOlderMessages: boolean;
  sending: boolean;
}

export const useTeamChatStore = create<TeamChatState>()(() => ({
  status: 'idle',
  error: undefined,
  identity: undefined,
  myProfile: undefined,
  messages: [],
  unreadCount: 0,
  hasUnseenMention: false,
  drawerOpen: false,
  hasOlderMessages: false,
  loadingOlderMessages: false,
  sending: false,
}));
