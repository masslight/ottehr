import Oystehr from '@oystehr/sdk';
import type { Client, Conversation, Message, Paginator } from '@twilio/conversations';
import { getTeamChatAccess } from '../../api/api';
import { TeamChatMention, TeamChatMessage, TeamChatMessageAttributes, useTeamChatStore } from './team-chat.store';

interface ConnectParams {
  oystehrZambda: Oystehr;
  myProfile: string;
  myName: string;
  onMention: (message: TeamChatMessage) => void;
}

const INITIAL_PAGE_SIZE = 30;

// Twilio client state lives at module scope (like the m2m token in zambdas): the
// connection outlives any single component, and the zustand store only holds
// serializable state for rendering.
let client: Client | undefined;
let conversation: Conversation | undefined;
let paginator: Paginator<Message> | undefined;
let myIdentity: string | undefined;
// Guards stale async work after a disconnect/reconnect cycle (e.g. logout/login).
let epoch = 0;

function toDto(message: Message): TeamChatMessage {
  const attributes = (message.attributes ?? {}) as TeamChatMessageAttributes;
  return {
    sid: message.sid,
    index: message.index,
    author: message.author ?? '',
    body: message.body ?? '',
    dateCreated: message.dateCreated?.toISOString(),
    attributes,
  };
}

export async function connectTeamChat(params: ConnectParams): Promise<void> {
  const { status } = useTeamChatStore.getState();
  if (status === 'connecting' || status === 'connected') return;
  const myEpoch = ++epoch;
  useTeamChatStore.setState({ status: 'connecting', error: undefined, myProfile: params.myProfile });

  try {
    const access = await getTeamChatAccess(params.oystehrZambda);
    const { Client: TwilioClient } = await import('@twilio/conversations');
    if (myEpoch !== epoch) return;

    const newClient = new TwilioClient(access.token);
    client = newClient;
    await new Promise<void>((resolve, reject) => {
      newClient.on('stateChanged', (state) => {
        if (state === 'initialized') resolve();
        if (state === 'failed') reject(new Error('Twilio client failed to initialize'));
      });
    });
    if (myEpoch !== epoch) {
      void newClient.shutdown();
      return;
    }
    myIdentity = newClient.user.identity;

    const refresh = async (): Promise<void> => {
      try {
        const refreshed = await getTeamChatAccess(params.oystehrZambda);
        if (myEpoch !== epoch) return;
        await newClient.updateToken(refreshed.token);
      } catch (error) {
        console.error('team chat token refresh failed', error);
      }
    };
    newClient.on('tokenAboutToExpire', () => void refresh());
    newClient.on('tokenExpired', () => void refresh());

    conversation = await newClient.getConversationBySid(access.conversationId);
    paginator = await conversation.getMessages(INITIAL_PAGE_SIZE);
    if (myEpoch !== epoch) return;

    const unread = await getUnreadCount();
    if (myEpoch !== epoch) return;

    conversation.on('messageAdded', (message) => {
      if (myEpoch !== epoch) return;
      handleMessageAdded(toDto(message), params.onMention);
    });

    useTeamChatStore.setState({
      status: 'connected',
      identity: myIdentity,
      messages: paginator.items.map(toDto),
      hasOlderMessages: paginator.hasPrevPage,
      unreadCount: unread,
    });
  } catch (error) {
    console.error('team chat connect failed', error);
    if (myEpoch !== epoch) return;
    useTeamChatStore.setState({
      status: 'error',
      error: error instanceof Error ? error.message : JSON.stringify(error),
    });
  }
}

export function disconnectTeamChat(): void {
  epoch++;
  void client?.shutdown();
  client = undefined;
  conversation = undefined;
  paginator = undefined;
  myIdentity = undefined;
  useTeamChatStore.setState({
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
  });
}

export async function sendTeamChatMessage(
  body: string,
  mentions: TeamChatMention[],
  senderName: string
): Promise<void> {
  if (!conversation) throw new Error('Team chat is not connected');
  const { myProfile } = useTeamChatStore.getState();
  const attributes: TeamChatMessageAttributes = {
    senderName,
    senderProfile: myProfile,
    mentions,
  };
  useTeamChatStore.setState({ sending: true });
  try {
    // Twilio types attributes as JSONValue; our attributes object is plain JSON.
    await conversation.sendMessage(body, JSON.parse(JSON.stringify(attributes)));
  } finally {
    useTeamChatStore.setState({ sending: false });
  }
}

export async function loadOlderTeamChatMessages(): Promise<void> {
  if (!paginator?.hasPrevPage || useTeamChatStore.getState().loadingOlderMessages) return;
  const myEpoch = epoch;
  useTeamChatStore.setState({ loadingOlderMessages: true });
  try {
    const previous = await paginator.prevPage();
    if (myEpoch !== epoch) return;
    paginator = previous;
    useTeamChatStore.setState((state) => ({
      messages: [...previous.items.map(toDto), ...state.messages],
      hasOlderMessages: previous.hasPrevPage,
      loadingOlderMessages: false,
    }));
  } catch (error) {
    console.error('team chat load older failed', error);
    if (myEpoch !== epoch) return;
    useTeamChatStore.setState({ loadingOlderMessages: false });
  }
}

export function openTeamChatDrawer(): void {
  useTeamChatStore.setState({ drawerOpen: true, hasUnseenMention: false, unreadCount: 0 });
  void conversation?.setAllMessagesRead();
}

export function closeTeamChatDrawer(): void {
  useTeamChatStore.setState({ drawerOpen: false });
}

async function getUnreadCount(): Promise<number> {
  if (!conversation) return 0;
  // Twilio returns null until the participant has ever set a read horizon;
  // everything is unread in that case.
  const unread = await conversation.getUnreadMessagesCount();
  if (unread !== null) return unread;
  return conversation.getMessagesCount();
}

function handleMessageAdded(message: TeamChatMessage, onMention: (message: TeamChatMessage) => void): void {
  const { drawerOpen, myProfile } = useTeamChatStore.getState();
  const isMine = message.author === myIdentity;

  useTeamChatStore.setState((state) => ({
    messages: [...state.messages, message],
    unreadCount: drawerOpen || isMine ? state.unreadCount : state.unreadCount + 1,
  }));

  if (drawerOpen) {
    void conversation?.setAllMessagesRead();
    return;
  }

  const mentioned =
    !isMine && myProfile != null && (message.attributes.mentions ?? []).some((m) => m.profile === myProfile);
  if (mentioned) {
    useTeamChatStore.setState({ hasUnseenMention: true });
    onMention(message);
  }
}
