import Oystehr from '@oystehr/sdk';
import type { Client, Conversation, Message, Paginator } from '@twilio/conversations';
import { EmployeeChatSummary } from 'utils/lib/types/api/employee-chat.types';
import { getEmployeeChats, openEmployeeChat } from '../../api/api';
import { ChatListItem, ChatMessage, initialEmployeeChatState, useEmployeeChatStore } from './employee-chat.store';
import { upsertByIndex } from './employee-chat.utils';

export const INITIAL_PAGE_SIZE = 50;
const PREVIEW_CONCURRENCY = 5;
const JOIN_TIMEOUT_MS = 5000;

let client: Client | undefined;
let oystehrZambda: Oystehr | undefined;
let myIdentity: string | undefined;
let activePaginator: Paginator<Message> | undefined;
let epoch = 0;
let chatListRefresh: Promise<void> | undefined;
const conversationsBySid = new Map<string, Conversation>();
const summariesBySid = new Map<string, EmployeeChatSummary>();
const joinWaiters = new Map<string, (conversation: Conversation) => void>();
const previewsRequested = new Set<string>();
const unknownSidsRefreshed = new Set<string>();

const setState = useEmployeeChatStore.setState;
const getState = useEmployeeChatStore.getState;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : JSON.stringify(error);
}

export function toChatMessage(message: Message, identity: string | undefined): ChatMessage {
  return {
    sid: message.sid,
    index: message.index,
    mine: identity !== undefined && message.author === identity,
    body: message.body ?? '',
    dateCreated: message.dateCreated?.toISOString(),
  };
}

function conversationMeta(
  conversation: Conversation
): Pick<ChatListItem, 'lastMessageIndex' | 'lastMessageAt' | 'lastReadIndex'> {
  return {
    lastMessageIndex: conversation.lastMessage?.index,
    lastMessageAt: conversation.lastMessage?.dateCreated?.toISOString(),
    lastReadIndex: conversation.lastReadMessageIndex,
  };
}

function maxIndex(a: number | null | undefined, b: number | null | undefined): number | undefined {
  if (a == null) return b ?? undefined;
  if (b == null) return a;
  return Math.max(a, b);
}

function syncChat(sid: string): void {
  const summary = summariesBySid.get(sid);
  const conversation = conversationsBySid.get(sid);
  if (!summary || !conversation) return;
  const meta = conversationMeta(conversation);
  setState((state) => {
    const existing = state.chats[sid];
    return {
      chats: {
        ...state.chats,
        [sid]: {
          ...existing,
          sid,
          otherEmployee: summary.otherEmployee,
          lastMessageIndex: maxIndex(meta.lastMessageIndex, existing?.lastMessageIndex),
          lastMessageAt: meta.lastMessageAt ?? existing?.lastMessageAt,
          lastReadIndex: maxIndex(meta.lastReadIndex, existing?.lastReadIndex),
        },
      },
    };
  });
}

function refreshForUnknownConversation(sid: string): void {
  if (summariesBySid.has(sid) || unknownSidsRefreshed.has(sid)) return;
  unknownSidsRefreshed.add(sid);
  void refreshChatList();
}

function applySummaries(summaries: EmployeeChatSummary[]): void {
  summaries.forEach((summary) => summariesBySid.set(summary.conversationSid, summary));
  summaries.forEach((summary) => syncChat(summary.conversationSid));
}

function registerConversation(conversation: Conversation): void {
  conversationsBySid.set(conversation.sid, conversation);
  joinWaiters.get(conversation.sid)?.(conversation);
  joinWaiters.delete(conversation.sid);
  if (summariesBySid.has(conversation.sid)) {
    syncChat(conversation.sid);
  } else if (getState().status === 'connected') {
    refreshForUnknownConversation(conversation.sid);
  }
}

export function refreshChatList(): Promise<void> {
  if (!oystehrZambda) return Promise.resolve();
  if (chatListRefresh) return chatListRefresh;
  const myEpoch = epoch;
  const zambda = oystehrZambda;
  chatListRefresh = (async () => {
    try {
      const access = await getEmployeeChats(zambda);
      if (myEpoch !== epoch) return;
      applySummaries(access.conversations);
    } catch (error) {
      console.error('employee chat list refresh failed', error);
    } finally {
      chatListRefresh = undefined;
    }
  })();
  return chatListRefresh;
}

async function markRead(sid: string): Promise<void> {
  const conversation = conversationsBySid.get(sid);
  if (!conversation) return;
  const myEpoch = epoch;
  try {
    await conversation.setAllMessagesRead();
    if (myEpoch !== epoch) return;
    setState((state) => {
      const chat = state.chats[sid];
      if (!chat) return {};
      return {
        chats: { ...state.chats, [sid]: { ...chat, lastReadIndex: chat.lastMessageIndex ?? chat.lastReadIndex } },
      };
    });
  } catch (error) {
    console.error('employee chat mark read failed', error);
  }
}

function isViewing(sid: string): boolean {
  const { drawerOpen, view, activeSid } = getState();
  return drawerOpen && view === 'conversation' && activeSid === sid;
}

function handleMessageAdded(message: Message): void {
  const sid = message.conversation.sid;
  if (!conversationsBySid.has(sid)) conversationsBySid.set(sid, message.conversation);
  const dto = toChatMessage(message, myIdentity);

  setState((state) => {
    const chat = state.chats[sid];
    const updates: Partial<typeof state> = {};
    if (chat) {
      const isNewest = chat.lastMessageIndex == null || dto.index >= chat.lastMessageIndex;
      updates.chats = {
        ...state.chats,
        [sid]: isNewest
          ? {
              ...chat,
              lastMessageIndex: dto.index,
              lastMessageAt: dto.dateCreated ?? chat.lastMessageAt,
              preview: { body: dto.body, mine: dto.mine },
            }
          : chat,
      };
    }
    if (state.activeSid === sid) {
      updates.messages = upsertByIndex(state.messages, [dto]);
    }
    return updates;
  });

  refreshForUnknownConversation(sid);
  if (isViewing(sid)) {
    void markRead(sid);
  }
}

async function loadAllSubscribedConversations(twilioClient: Client): Promise<Conversation[]> {
  const conversations: Conversation[] = [];
  let page = await twilioClient.getSubscribedConversations();
  conversations.push(...page.items);
  while (page.hasNextPage) {
    page = await page.nextPage();
    conversations.push(...page.items);
  }
  return conversations;
}

async function resync(): Promise<void> {
  const myEpoch = epoch;
  conversationsBySid.forEach((_conversation, sid) => syncChat(sid));
  await refreshChatList();
  const { activeSid } = getState();
  const conversation = activeSid ? conversationsBySid.get(activeSid) : undefined;
  if (!activeSid || !conversation) return;
  try {
    const latest = await conversation.getMessages(INITIAL_PAGE_SIZE);
    if (myEpoch !== epoch || getState().activeSid !== activeSid) return;
    setState((state) => ({
      messages: upsertByIndex(
        state.messages,
        latest.items.map((m) => toChatMessage(m, myIdentity))
      ),
    }));
    if (isViewing(activeSid)) void markRead(activeSid);
  } catch (error) {
    console.error('employee chat resync failed', error);
  }
}

export async function connectEmployeeChat(params: { oystehrZambda: Oystehr; myProfile: string }): Promise<void> {
  const { status } = getState();
  if (status === 'connecting' || status === 'connected' || status === 'reconnecting') return;
  const myEpoch = ++epoch;
  oystehrZambda = params.oystehrZambda;
  setState({ status: 'connecting', error: undefined, myProfile: params.myProfile });

  try {
    const access = await getEmployeeChats(params.oystehrZambda);
    const { Client: TwilioClient } = await import('@twilio/conversations');
    if (myEpoch !== epoch) return;
    access.conversations.forEach((summary) => summariesBySid.set(summary.conversationSid, summary));

    const newClient = new TwilioClient(access.token);
    client = newClient;

    const guard =
      <A extends unknown[]>(handler: (...args: A) => void) =>
      (...args: A): void => {
        if (myEpoch === epoch) handler(...args);
      };

    const refreshToken = async (): Promise<void> => {
      try {
        const refreshed = await getEmployeeChats(params.oystehrZambda);
        if (myEpoch !== epoch) return;
        await newClient.updateToken(refreshed.token);
        applySummaries(refreshed.conversations);
      } catch (error) {
        console.error('employee chat token refresh failed', error);
        if (myEpoch === epoch) setState({ status: 'error', error: 'Chat session expired' });
      }
    };

    newClient.on('conversationJoined', guard(registerConversation));
    newClient.on('conversationAdded', guard(registerConversation));
    newClient.on(
      'conversationUpdated',
      guard(({ conversation }) => {
        conversationsBySid.set(conversation.sid, conversation);
        syncChat(conversation.sid);
      })
    );
    newClient.on('messageAdded', guard(handleMessageAdded));
    newClient.on(
      'connectionStateChanged',
      guard((state) => {
        const current = getState().status;
        if (state === 'connected' && current === 'reconnecting') {
          setState({ status: 'connected' });
          void resync();
        } else if ((state === 'connecting' || state === 'disconnected') && current === 'connected') {
          setState({ status: 'reconnecting' });
        } else if (state === 'denied') {
          setState({ status: 'error', error: 'Chat connection was denied' });
        }
      })
    );
    newClient.on(
      'tokenAboutToExpire',
      guard(() => void refreshToken())
    );
    newClient.on(
      'tokenExpired',
      guard(() => void refreshToken())
    );

    await new Promise<void>((resolve, reject) => {
      newClient.on('initialized', resolve);
      newClient.on('initFailed', ({ error }) =>
        reject(new Error(error?.message ?? 'Chat client failed to initialize'))
      );
    });
    if (myEpoch !== epoch) {
      void newClient.shutdown();
      return;
    }
    myIdentity = newClient.user.identity;

    const subscribed = await loadAllSubscribedConversations(newClient);
    if (myEpoch !== epoch) return;
    subscribed.forEach((conversation) => conversationsBySid.set(conversation.sid, conversation));
    applySummaries(access.conversations);
    setState({ status: 'connected' });
  } catch (error) {
    console.error('employee chat connect failed', error);
    if (myEpoch !== epoch) return;
    setState({ status: 'error', error: errorMessage(error) });
  }
}

export function disconnectEmployeeChat(): void {
  epoch++;
  void client?.shutdown();
  client = undefined;
  oystehrZambda = undefined;
  myIdentity = undefined;
  activePaginator = undefined;
  chatListRefresh = undefined;
  conversationsBySid.clear();
  summariesBySid.clear();
  joinWaiters.clear();
  previewsRequested.clear();
  unknownSidsRefreshed.clear();
  setState({ ...initialEmployeeChatState });
}

export async function retryEmployeeChat(): Promise<void> {
  const zambda = oystehrZambda;
  const { myProfile } = getState();
  disconnectEmployeeChat();
  if (zambda && myProfile) await connectEmployeeChat({ oystehrZambda: zambda, myProfile });
}

export function openEmployeeChatDrawer(): void {
  setState({ drawerOpen: true });
  const { activeSid, view } = getState();
  if (view === 'conversation' && activeSid) void markRead(activeSid);
}

export function closeEmployeeChatDrawer(): void {
  setState({ drawerOpen: false });
}

export function showChatList(): void {
  activePaginator = undefined;
  setState({ view: 'list', activeSid: undefined, messages: [], hasOlderMessages: false, loadingOlder: false });
}

export async function openConversation(sid: string): Promise<void> {
  const conversation = conversationsBySid.get(sid);
  if (!conversation) return;
  const myEpoch = epoch;
  activePaginator = undefined;
  setState({
    view: 'conversation',
    activeSid: sid,
    messages: [],
    hasOlderMessages: false,
    loadingOlder: false,
    loadingMessages: true,
    openError: undefined,
  });
  try {
    const page = await conversation.getMessages(INITIAL_PAGE_SIZE);
    if (myEpoch !== epoch || getState().activeSid !== sid) return;
    activePaginator = page;
    setState((state) => ({
      messages: upsertByIndex(
        state.messages,
        page.items.map((m) => toChatMessage(m, myIdentity))
      ),
      hasOlderMessages: page.hasPrevPage,
      loadingMessages: false,
    }));
    if (isViewing(sid)) await markRead(sid);
  } catch (error) {
    console.error('employee chat load messages failed', error);
    if (myEpoch !== epoch || getState().activeSid !== sid) return;
    setState({ loadingMessages: false, openError: 'Could not load messages' });
  }
}

export async function loadOlderMessages(): Promise<void> {
  const { activeSid, loadingOlder } = getState();
  const paginator = activePaginator;
  if (!paginator?.hasPrevPage || loadingOlder || !activeSid) return;
  const myEpoch = epoch;
  setState({ loadingOlder: true });
  try {
    const previous = await paginator.prevPage();
    if (myEpoch !== epoch || getState().activeSid !== activeSid) return;
    activePaginator = previous;
    setState((state) => ({
      messages: upsertByIndex(
        state.messages,
        previous.items.map((m) => toChatMessage(m, myIdentity))
      ),
      hasOlderMessages: previous.hasPrevPage,
      loadingOlder: false,
    }));
  } catch (error) {
    console.error('employee chat load older failed', error);
    if (myEpoch !== epoch) return;
    setState({ loadingOlder: false });
  }
}

function waitForConversation(sid: string): Promise<Conversation> {
  const known = conversationsBySid.get(sid);
  if (known) return Promise.resolve(known);
  return new Promise<Conversation>((resolve, reject) => {
    const timer = setTimeout(() => {
      joinWaiters.delete(sid);
      if (!client) {
        reject(new Error('Chat is not connected'));
        return;
      }
      client
        .getConversationBySid(sid)
        .then((conversation) => {
          conversationsBySid.set(sid, conversation);
          resolve(conversation);
        })
        .catch(reject);
    }, JOIN_TIMEOUT_MS);
    joinWaiters.set(sid, (conversation) => {
      clearTimeout(timer);
      resolve(conversation);
    });
  });
}

export async function openChatWithEmployee(profile: string): Promise<void> {
  const existing = Object.values(getState().chats).find((chat) => chat.otherEmployee.profile === profile);
  if (existing) {
    await openConversation(existing.sid);
    return;
  }
  if (!oystehrZambda) return;
  const myEpoch = epoch;
  setState({ openingProfile: profile, openError: undefined });
  try {
    const { conversation: summary } = await openEmployeeChat(oystehrZambda, { targetProfile: profile });
    if (myEpoch !== epoch) return;
    summariesBySid.set(summary.conversationSid, summary);
    await waitForConversation(summary.conversationSid);
    if (myEpoch !== epoch) return;
    syncChat(summary.conversationSid);
    setState({ openingProfile: undefined });
    await openConversation(summary.conversationSid);
  } catch (error) {
    console.error('employee chat open failed', error);
    if (myEpoch !== epoch) return;
    setState({ openingProfile: undefined, openError: 'Could not open the chat. Please try again.' });
  }
}

export async function sendChatMessage(body: string): Promise<void> {
  const { activeSid } = getState();
  const conversation = activeSid ? conversationsBySid.get(activeSid) : undefined;
  if (!activeSid || !conversation) throw new Error('No conversation is open');
  await conversation.sendMessage(body);
  void markRead(activeSid);
}

export async function loadMissingPreviews(): Promise<void> {
  const myEpoch = epoch;
  const pending = Object.values(getState().chats)
    .filter((chat) => chat.lastMessageIndex != null && !chat.preview && !previewsRequested.has(chat.sid))
    .map((chat) => chat.sid);
  pending.forEach((sid) => previewsRequested.add(sid));

  const worker = async (): Promise<void> => {
    for (let sid = pending.shift(); sid; sid = pending.shift()) {
      const conversation = conversationsBySid.get(sid);
      if (!conversation) continue;
      try {
        const page = await conversation.getMessages(1);
        const last = page.items[page.items.length - 1];
        if (myEpoch !== epoch || !last) continue;
        const dto = toChatMessage(last, myIdentity);
        setState((state) => {
          const chat = state.chats[sid];
          if (!chat || chat.preview) return {};
          return { chats: { ...state.chats, [sid]: { ...chat, preview: { body: dto.body, mine: dto.mine } } } };
        });
      } catch (error) {
        console.error('employee chat preview failed', error);
        previewsRequested.delete(sid);
      }
    }
  };
  await Promise.all(Array.from({ length: PREVIEW_CONCURRENCY }, worker));
}
