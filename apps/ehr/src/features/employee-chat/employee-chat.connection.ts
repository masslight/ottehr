import Oystehr from '@oystehr/sdk';
import type { Client, Conversation, Message, Paginator } from '@twilio/conversations';
import { EmployeeChatParticipant, EmployeeChatSummary } from 'utils/lib/types/api/employee-chat.types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { getEmployeeChats, openEmployeeChat } from '../../api/api';
import {
  ChatListItem,
  ChatMessage,
  HistorySegment,
  initialEmployeeChatState,
  UnreadEntry,
  useEmployeeChatStore,
} from './employee-chat.store';
import { computeDividerIndex, unreadStartsAboveLoaded, upsertByIndex } from './employee-chat.utils';

export const INITIAL_PAGE_SIZE = 50;
export const UNREAD_PRELOAD_CAP = 200;
const PREVIEW_CONCURRENCY = 5;
const JOIN_TIMEOUT_MS = 5000;
const UNKNOWN_SID_RETRY_DELAYS_MS = [500, 1000, 2000, 4000];
const UNKNOWN_SID_IDLE_REFRESH_MS = 60_000;

interface UnknownSidDiscovery {
  retries: number;
  refreshing: boolean;
  timer?: ReturnType<typeof setTimeout>;
  lastRefreshAt: number;
}

let client: Client | undefined;
let oystehrZambda: Oystehr | undefined;
let myIdentity: string | undefined;
let activePaginator: Paginator<Message> | undefined;
let epoch = 0;
let openSeq = 0;
let entrySeq = 0;
let chatListRefresh: Promise<void> | undefined;
const conversationsBySid = new Map<string, Conversation>();
const summariesBySid = new Map<string, EmployeeChatSummary>();
const joinWaiters = new Map<string, (conversation: Conversation) => void>();
const previewsRequested = new Set<string>();
const historyPreviewsRequested = new Set<string>();
const unknownSidDiscoveries = new Map<string, UnknownSidDiscovery>();
const pendingReadIndex = new Map<string, number>();
const retiredSids = new Set<string>();
const lookupsRequested = new Set<string>();
const historyCache = new Map<string, { messages: ChatMessage[]; paginator: Paginator<Message> | undefined }>();
let activeHistorySids: string[] = [];
let recoveringSid: string | undefined;

const setState = useEmployeeChatStore.setState;
const getState = useEmployeeChatStore.getState;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : JSON.stringify(error);
}

function isClosed(conversation: Conversation): boolean {
  return conversation.state?.current === 'closed';
}

function isWritable(conversation: Conversation): boolean {
  return conversation.status === 'joined' && !isClosed(conversation);
}

function previousSidsOf(summary: EmployeeChatSummary | undefined): string[] {
  return summary?.previousConversationSids ?? [];
}

function isChatUnavailable(error: unknown): boolean {
  const detail = error instanceof Error ? error.message : JSON.stringify(error);
  try {
    return (JSON.parse(detail) as { code?: unknown } | null)?.code === APIErrorCode.MISCONFIGURED_ENVIRONMENT;
  } catch {
    return false;
  }
}

function isForbidden(error: unknown): boolean {
  return (error as { status?: number } | undefined)?.status === 403;
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
  const closed = isClosed(conversation);
  const hasHistory = previousSidsOf(summary).length > 0;
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
          closed: closed || existing?.closed ? true : undefined,
          hasHistory: hasHistory ? true : undefined,
        },
      },
    };
  });
}

function dropChats(sids: string[]): void {
  if (sids.length === 0) return;
  setState((state) => {
    const chats = { ...state.chats };
    sids.forEach((sid) => delete chats[sid]);
    return { chats };
  });
}

function upsertSummary(summary: EmployeeChatSummary): void {
  const previous = previousSidsOf(summary);
  [summary.conversationSid, ...previous].forEach(stopUnknownSidDiscovery);
  if (retiredSids.has(summary.conversationSid)) return;
  previous.forEach((sid) => retiredSids.add(sid));
  const replaced = [...summariesBySid.entries()]
    .filter(
      ([sid, existing]) =>
        sid !== summary.conversationSid &&
        (previous.includes(sid) || existing.otherEmployee.profile === summary.otherEmployee.profile)
    )
    .map(([sid]) => sid);
  replaced.forEach((sid) => summariesBySid.delete(sid));
  [...replaced, ...previous].forEach((sid) => conversationsBySid.delete(sid));
  summariesBySid.set(summary.conversationSid, summary);
  dropChats(replaced);
  followReplacement(replaced, summary);
}

function followReplacement(replaced: string[], summary: EmployeeChatSummary): void {
  const { view, activeSid } = getState();
  if (view !== 'conversation' || !activeSid || !replaced.includes(activeSid) || recoveringSid === activeSid) return;
  const myEpoch = epoch;
  const myOpen = openSeq;
  setState({ pendingEmployee: summary.otherEmployee });
  waitForConversation(summary.conversationSid)
    .then(async () => {
      if (myEpoch !== epoch || myOpen !== openSeq || getState().activeSid !== activeSid) return;
      syncChat(summary.conversationSid);
      await openConversation(summary.conversationSid);
    })
    .catch((error) => console.error('employee chat could not follow the replacement conversation', error));
}

function isUnknownSid(sid: string): boolean {
  return !summariesBySid.has(sid) && !retiredSids.has(sid);
}

function stopUnknownSidDiscovery(sid: string): void {
  const discovery = unknownSidDiscoveries.get(sid);
  if (discovery?.timer) clearTimeout(discovery.timer);
  unknownSidDiscoveries.delete(sid);
}

function refreshUntilKnown(sid: string, discovery: UnknownSidDiscovery): void {
  discovery.refreshing = true;
  void (chatListRefresh ?? Promise.resolve())
    .then(() => {
      discovery.lastRefreshAt = Date.now();
      return refreshChatList();
    })
    .finally(() => {
      discovery.refreshing = false;
      if (unknownSidDiscoveries.get(sid) !== discovery) return;
      if (!isUnknownSid(sid)) {
        unknownSidDiscoveries.delete(sid);
        return;
      }
      const delay = UNKNOWN_SID_RETRY_DELAYS_MS[discovery.retries];
      if (delay === undefined) return;
      discovery.retries++;
      discovery.timer = setTimeout(() => {
        discovery.timer = undefined;
        if (unknownSidDiscoveries.get(sid) === discovery) refreshUntilKnown(sid, discovery);
      }, delay);
    });
}

function refreshForUnknownConversation(sid: string): void {
  if (!isUnknownSid(sid)) {
    stopUnknownSidDiscovery(sid);
    return;
  }
  const existing = unknownSidDiscoveries.get(sid);
  if (
    existing &&
    (existing.refreshing ||
      existing.timer !== undefined ||
      Date.now() - existing.lastRefreshAt < UNKNOWN_SID_IDLE_REFRESH_MS)
  ) {
    return;
  }
  const discovery = existing ?? { retries: 0, refreshing: false, lastRefreshAt: 0 };
  unknownSidDiscoveries.set(sid, discovery);
  refreshUntilKnown(sid, discovery);
}

function applySummaries(summaries: EmployeeChatSummary[]): void {
  summaries.forEach(upsertSummary);
  summaries.forEach((summary) => syncChat(summary.conversationSid));
  void loadMissingConversations();
}

function recoverIfActive(sid: string): void {
  const { view, activeSid } = getState();
  if (view === 'conversation' && activeSid === sid) void recoverClosedConversation(sid);
}

function registerConversation(conversation: Conversation): void {
  const sid = conversation.sid;
  if (retiredSids.has(sid)) return;
  conversationsBySid.set(sid, conversation);
  joinWaiters.get(sid)?.(conversation);
  joinWaiters.delete(sid);
  if (summariesBySid.has(sid)) {
    syncChat(sid);
    if (isClosed(conversation)) recoverIfActive(sid);
  } else if (getState().status === 'connected' && conversation.status === 'joined') {
    refreshForUnknownConversation(sid);
  }
}

function handleConversationUpdated(conversation: Conversation): void {
  const sid = conversation.sid;
  if (retiredSids.has(sid)) return;
  conversationsBySid.set(sid, conversation);
  syncChat(sid);
  if (isClosed(conversation)) recoverIfActive(sid);
}

function handleConversationGone(conversation: Conversation): void {
  const sid = conversation.sid;
  stopUnknownSidDiscovery(sid);
  if (retiredSids.has(sid)) return;
  if (isClosed(conversation)) {
    conversationsBySid.set(sid, conversation);
    syncChat(sid);
    recoverIfActive(sid);
    return;
  }
  if (!conversationsBySid.has(sid)) return;
  conversationsBySid.delete(sid);
  if (!summariesBySid.has(sid)) return;
  dropChats([sid]);
  lookupsRequested.delete(sid);
  const { view, activeSid, recovery } = getState();
  if (view === 'conversation' && activeSid === sid && recovery === undefined) {
    setState({ openError: 'This chat is no longer available.' });
  }
  void refreshChatList().then(loadMissingConversations);
}

async function applyParticipantReadHorizon(conversation: Conversation, myEpoch: number): Promise<void> {
  try {
    const mine = (await conversation.getParticipants()).find((participant) => participant.identity === myIdentity);
    const index = mine?.lastReadMessageIndex;
    if (myEpoch !== epoch || index == null) return;
    setState((state) => {
      const chat = state.chats[conversation.sid];
      if (!chat) return {};
      return {
        chats: { ...state.chats, [conversation.sid]: { ...chat, lastReadIndex: maxIndex(chat.lastReadIndex, index) } },
      };
    });
  } catch (error) {
    console.error('employee chat participant read horizon failed', error);
  }
}

async function loadMissingConversation(twilioClient: Client, sid: string, myEpoch: number): Promise<void> {
  try {
    const conversation = await twilioClient.peekConversationBySid(sid);
    if (myEpoch !== epoch || !summariesBySid.has(sid) || retiredSids.has(sid)) return;
    if (!isClosed(conversation) && conversation.status !== 'joined') return;
    conversationsBySid.set(sid, conversation);
    syncChat(sid);
    if (isClosed(conversation)) {
      await applyParticipantReadHorizon(conversation, myEpoch);
      recoverIfActive(sid);
    }
  } catch (error) {
    console.error('employee chat conversation lookup failed', error);
    if (!isForbidden(error)) lookupsRequested.delete(sid);
  }
}

async function loadMissingConversations(): Promise<void> {
  const twilioClient = client;
  if (!twilioClient || !myIdentity) return;
  const myEpoch = epoch;
  const pending = [...summariesBySid.keys()].filter(
    (sid) => !conversationsBySid.has(sid) && !lookupsRequested.has(sid)
  );
  pending.forEach((sid) => lookupsRequested.add(sid));
  const worker = async (): Promise<void> => {
    for (let sid = pending.shift(); sid; sid = pending.shift()) {
      await loadMissingConversation(twilioClient, sid, myEpoch);
    }
  };
  await Promise.all(Array.from({ length: PREVIEW_CONCURRENCY }, worker));
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

async function advanceReadHorizon(sid: string, index: number): Promise<void> {
  const conversation = conversationsBySid.get(sid);
  if (!conversation || conversation.status !== 'joined' || conversation.state?.current === 'closed') return;
  const known = maxIndex(getState().chats[sid]?.lastReadIndex, pendingReadIndex.get(sid));
  if (known !== undefined && index <= known) return;
  const myEpoch = epoch;
  pendingReadIndex.set(sid, index);
  try {
    await conversation.advanceLastReadMessageIndex(index);
    if (myEpoch !== epoch) return;
    setState((state) => {
      const chat = state.chats[sid];
      if (!chat) return {};
      return { chats: { ...state.chats, [sid]: { ...chat, lastReadIndex: maxIndex(chat.lastReadIndex, index) } } };
    });
  } catch (error) {
    console.error('employee chat advance read horizon failed', error);
  } finally {
    if (myEpoch === epoch && pendingReadIndex.get(sid) === index) pendingReadIndex.delete(sid);
  }
}

export function markActiveConversationSeen(index: number): void {
  const { drawerOpen, view, activeSid, loadingMessages, unreadEntry } = getState();
  if (!drawerOpen || view !== 'conversation' || !activeSid || loadingMessages) return;
  if (unreadEntry?.sid === activeSid && unreadEntry.unreadAbove) return;
  void advanceReadHorizon(activeSid, index);
}

export function markMissedMessage(index: number): void {
  const { activeSid, unreadEntry } = getState();
  if (!activeSid || unreadEntry?.sid !== activeSid) return;
  if (unreadEntry.unreadAbove || unreadEntry.dividerIndex !== undefined) return;
  if (index <= (readHorizon(activeSid) ?? -1)) return;
  setState({ unreadEntry: { ...unreadEntry, dividerIndex: index } });
}

function handleMessageAdded(message: Message): void {
  const sid = message.conversation.sid;
  if (retiredSids.has(sid)) return;
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
  if (dto.mine) {
    void advanceReadHorizon(sid, dto.index);
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
  if (!activeSid || !conversation || !isWritable(conversation) || getState().recovery !== undefined) return;
  try {
    const latest = await conversation.getMessages(INITIAL_PAGE_SIZE);
    if (myEpoch !== epoch || getState().activeSid !== activeSid) return;
    setState((state) => ({
      messages: upsertByIndex(
        state.messages,
        latest.items.map((m) => toChatMessage(m, myIdentity))
      ),
    }));
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
    access.conversations.forEach(upsertSummary);

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
      guard(({ conversation }) => handleConversationUpdated(conversation))
    );
    newClient.on('conversationLeft', guard(handleConversationGone));
    newClient.on('conversationRemoved', guard(handleConversationGone));
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
    subscribed
      .filter((conversation) => !retiredSids.has(conversation.sid))
      .forEach((conversation) => conversationsBySid.set(conversation.sid, conversation));
    applySummaries(access.conversations);
    setState({ status: 'connected' });
  } catch (error) {
    console.error('employee chat connect failed', error);
    if (myEpoch !== epoch) return;
    if (isChatUnavailable(error)) {
      setState({ status: 'unavailable', error: undefined });
      return;
    }
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
  historyPreviewsRequested.clear();
  unknownSidDiscoveries.forEach((discovery) => {
    if (discovery.timer) clearTimeout(discovery.timer);
  });
  unknownSidDiscoveries.clear();
  pendingReadIndex.clear();
  retiredSids.clear();
  lookupsRequested.clear();
  historyCache.clear();
  activeHistorySids = [];
  recoveringSid = undefined;
  setState({ ...initialEmployeeChatState });
}

export async function retryEmployeeChat(): Promise<void> {
  const zambda = oystehrZambda;
  const { myProfile } = getState();
  disconnectEmployeeChat();
  if (zambda && myProfile) await connectEmployeeChat({ oystehrZambda: zambda, myProfile });
}

function readHorizon(sid: string): number | undefined {
  return maxIndex(conversationsBySid.get(sid)?.lastReadMessageIndex, getState().chats[sid]?.lastReadIndex);
}

function entryPosition(
  messages: ChatMessage[],
  hasOlderMessages: boolean,
  horizon: number | undefined
): Pick<UnreadEntry, 'unreadAbove' | 'dividerIndex'> {
  const unreadAbove = unreadStartsAboveLoaded(messages, hasOlderMessages, horizon);
  return { unreadAbove, dividerIndex: unreadAbove ? undefined : computeDividerIndex(messages, horizon) };
}

function newEntry(
  sid: string,
  messages: ChatMessage[],
  hasOlderMessages: boolean,
  horizon: number | undefined
): UnreadEntry {
  return { id: ++entrySeq, sid, horizon, ...entryPosition(messages, hasOlderMessages, horizon) };
}

export function openEmployeeChatDrawer(): void {
  const { view, activeSid, messages, hasOlderMessages, loadingMessages, openError } = getState();
  if (view === 'conversation' && activeSid !== undefined && openError) {
    setState({ drawerOpen: true });
    void openConversation(activeSid);
    return;
  }
  const reentering = view === 'conversation' && activeSid !== undefined && !loadingMessages;
  setState({
    drawerOpen: true,
    openError: undefined,
    unreadEntry: reentering ? newEntry(activeSid, messages, hasOlderMessages, readHorizon(activeSid)) : undefined,
  });
}

export function closeEmployeeChatDrawer(): void {
  setState({ drawerOpen: false, unreadEntry: undefined });
}

const noHistory = { history: [], hasOlderHistory: false, recovery: undefined };

export function showChatList(): void {
  activePaginator = undefined;
  activeHistorySids = [];
  openSeq++;
  setState({
    view: 'list',
    activeSid: undefined,
    messages: [],
    hasOlderMessages: false,
    loadingOlder: false,
    unreadEntry: undefined,
    pendingEmployee: undefined,
    openError: undefined,
    ...noHistory,
  });
}

function historySegments(loaded: Set<string>): Pick<typeof initialEmployeeChatState, 'history' | 'hasOlderHistory'> {
  const history: HistorySegment[] = activeHistorySids
    .filter((sid) => loaded.has(sid))
    .map((sid) => {
      const entry = historyCache.get(sid);
      return { sid, messages: entry?.messages ?? [], hasOlder: entry?.paginator?.hasPrevPage ?? false };
    });
  const hasOlderHistory = (history[0]?.hasOlder ?? false) || activeHistorySids.some((sid) => !loaded.has(sid));
  return { history, hasOlderHistory };
}

async function loadHistoryConversation(sid: string): Promise<void> {
  if (historyCache.has(sid)) return;
  const twilioClient = client;
  if (!twilioClient) throw new Error('Chat is not connected');
  try {
    const conversation = conversationsBySid.get(sid) ?? (await twilioClient.peekConversationBySid(sid));
    const page = await conversation.getMessages(INITIAL_PAGE_SIZE);
    historyCache.set(sid, { messages: page.items.map((m) => toChatMessage(m, myIdentity)), paginator: page });
  } catch (error) {
    if (!isForbidden(error)) throw error;
    console.error(`employee chat history for ${sid} is not accessible`, error);
    historyCache.set(sid, { messages: [], paginator: undefined });
  }
}

async function loadOlderHistoryPage(sid: string): Promise<void> {
  const entry = historyCache.get(sid);
  if (!entry?.paginator?.hasPrevPage) return;
  const previous = await entry.paginator.prevPage();
  historyCache.set(sid, {
    messages: upsertByIndex(
      entry.messages,
      previous.items.map((m) => toChatMessage(m, myIdentity))
    ),
    paginator: previous,
  });
}

async function loadEarlierHistory(): Promise<void> {
  const { activeSid, history, loadingOlder } = getState();
  if (!activeSid || loadingOlder) return;
  const loaded = new Set(history.map((segment) => segment.sid));
  const top = history[0];
  const next = [...activeHistorySids].reverse().find((sid) => !loaded.has(sid));
  if (!top?.hasOlder && !next) return;
  const myEpoch = epoch;
  const myOpen = openSeq;
  const isCurrent = (): boolean => myEpoch === epoch && myOpen === openSeq && getState().activeSid === activeSid;
  setState({ loadingOlder: true });
  try {
    if (top?.hasOlder) {
      await loadOlderHistoryPage(top.sid);
    } else if (next) {
      await loadHistoryConversation(next);
      loaded.add(next);
    }
    if (!isCurrent()) return;
    setState({ ...historySegments(loaded), loadingOlder: false });
  } catch (error) {
    console.error('employee chat history load failed', error);
    if (isCurrent()) setState({ loadingOlder: false });
  }
}

async function recoverClosedConversation(closedSid: string): Promise<void> {
  const summary = summariesBySid.get(closedSid);
  const zambda = oystehrZambda;
  if (!summary || !zambda || recoveringSid === closedSid) return;
  recoveringSid = closedSid;
  const myEpoch = epoch;
  const myOpen = ++openSeq;
  activePaginator = undefined;
  activeHistorySids = [...previousSidsOf(summary), closedSid];
  setState({
    view: 'conversation',
    activeSid: closedSid,
    pendingEmployee: summary.otherEmployee,
    messages: [],
    hasOlderMessages: false,
    loadingOlder: false,
    loadingMessages: false,
    openError: undefined,
    unreadEntry: undefined,
    history: [],
    hasOlderHistory: true,
    recovery: 'recovering',
  });
  const isCurrent = (): boolean => myEpoch === epoch && myOpen === openSeq && getState().activeSid === closedSid;
  try {
    await loadEarlierHistory();
    const { conversation: next } = await openEmployeeChat(zambda, {
      targetProfile: summary.otherEmployee.profile,
      replaceClosedConversationSid: closedSid,
    });
    if (myEpoch !== epoch) return;
    upsertSummary(next);
    if (next.conversationSid === closedSid) {
      throw new Error(`Replacing closed conversation ${closedSid} returned the same conversation`);
    }
    const replacement = await waitForConversation(next.conversationSid);
    if (myEpoch !== epoch) return;
    syncChat(next.conversationSid);
    if (!isCurrent()) return;
    if (!isWritable(replacement)) {
      throw new Error(`Replacement conversation ${next.conversationSid} is not writable`);
    }
    recoveringSid = undefined;
    await openConversation(next.conversationSid);
  } catch (error) {
    console.error('employee chat recovery failed', error);
    if (isCurrent()) setState({ recovery: 'failed' });
  } finally {
    if (recoveringSid === closedSid) recoveringSid = undefined;
  }
}

export async function retryConversationRecovery(): Promise<void> {
  const { activeSid, pendingEmployee } = getState();
  if (!activeSid) return;
  if (summariesBySid.has(activeSid)) {
    await recoverClosedConversation(activeSid);
    return;
  }
  const current = [...summariesBySid.values()].find(
    (summary) => summary.otherEmployee.profile === pendingEmployee?.profile
  );
  if (!current || getState().recovery !== 'failed') return;
  const sid = current.conversationSid;
  const myEpoch = epoch;
  const myOpen = openSeq;
  const isCurrent = (): boolean => myEpoch === epoch && myOpen === openSeq && getState().activeSid === activeSid;
  setState({ recovery: 'recovering' });
  try {
    const replacement = await waitForConversation(sid);
    if (!isCurrent()) return;
    syncChat(sid);
    if (!isClosed(replacement) && !isWritable(replacement)) {
      throw new Error(`Replacement conversation ${sid} is not writable`);
    }
    await openConversation(sid);
  } catch (error) {
    console.error('employee chat recovery retry failed', error);
    if (isCurrent()) setState({ recovery: 'failed' });
  }
}

export async function openConversation(sid: string): Promise<void> {
  const conversation = conversationsBySid.get(sid);
  if (!conversation) return;
  if (isClosed(conversation)) {
    await recoverClosedConversation(sid);
    return;
  }
  const myEpoch = epoch;
  const myOpen = ++openSeq;
  const horizon = readHorizon(sid);
  activePaginator = undefined;
  activeHistorySids = previousSidsOf(summariesBySid.get(sid));
  setState({
    view: 'conversation',
    activeSid: sid,
    pendingEmployee: undefined,
    messages: [],
    hasOlderMessages: false,
    loadingOlder: false,
    loadingMessages: true,
    openError: undefined,
    unreadEntry: undefined,
    ...historySegments(new Set()),
    recovery: undefined,
  });
  const isCurrent = (): boolean => myEpoch === epoch && myOpen === openSeq && getState().activeSid === sid;
  try {
    let page = await conversation.getMessages(INITIAL_PAGE_SIZE);
    let items = [...page.items];
    while (
      isCurrent() &&
      items.length < UNREAD_PRELOAD_CAP &&
      unreadStartsAboveLoaded(items, page.hasPrevPage, horizon)
    ) {
      page = await page.prevPage();
      items = [...page.items, ...items];
    }
    if (!isCurrent()) return;
    activePaginator = page;
    const hasOlderMessages = page.hasPrevPage;
    setState((state) => {
      const messages = upsertByIndex(
        state.messages,
        items.map((m) => toChatMessage(m, myIdentity))
      );
      return {
        messages,
        hasOlderMessages,
        loadingMessages: false,
        unreadEntry: newEntry(sid, messages, hasOlderMessages, horizon),
      };
    });
    if (!hasOlderMessages) await loadEarlierHistory();
  } catch (error) {
    console.error('employee chat load messages failed', error);
    if (!isCurrent()) return;
    setState({
      loadingMessages: false,
      openError: 'Could not load messages',
      unreadEntry: newEntry(sid, [], false, horizon),
    });
  }
}

export async function loadOlderMessages(): Promise<void> {
  if (!activePaginator?.hasPrevPage) {
    await loadEarlierHistory();
    return;
  }
  const { activeSid, loadingOlder } = getState();
  const paginator = activePaginator;
  if (loadingOlder || !activeSid) return;
  const myEpoch = epoch;
  const myOpen = openSeq;
  setState({ loadingOlder: true });
  try {
    const previous = await paginator.prevPage();
    if (myEpoch !== epoch || myOpen !== openSeq || getState().activeSid !== activeSid) return;
    activePaginator = previous;
    setState((state) => {
      const messages = upsertByIndex(
        state.messages,
        previous.items.map((m) => toChatMessage(m, myIdentity))
      );
      const entry = state.unreadEntry;
      return {
        messages,
        hasOlderMessages: previous.hasPrevPage,
        loadingOlder: false,
        unreadEntry:
          entry?.sid === activeSid && entry.unreadAbove
            ? { ...entry, ...entryPosition(messages, previous.hasPrevPage, entry.horizon) }
            : entry,
      };
    });
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

export async function openChatWithEmployee(employee: EmployeeChatParticipant): Promise<void> {
  const existing = Object.values(getState().chats).find((chat) => chat.otherEmployee.profile === employee.profile);
  if (existing) {
    await openConversation(existing.sid);
    return;
  }
  if (!oystehrZambda) return;
  const myEpoch = epoch;
  const myOpen = ++openSeq;
  activePaginator = undefined;
  setState({
    view: 'conversation',
    activeSid: undefined,
    pendingEmployee: employee,
    messages: [],
    hasOlderMessages: false,
    loadingOlder: false,
    loadingMessages: true,
    openError: undefined,
    unreadEntry: undefined,
    ...noHistory,
  });
  activeHistorySids = [];
  try {
    const { conversation: summary } = await openEmployeeChat(oystehrZambda, { targetProfile: employee.profile });
    if (myEpoch !== epoch) return;
    upsertSummary(summary);
    await waitForConversation(summary.conversationSid);
    if (myEpoch !== epoch) return;
    syncChat(summary.conversationSid);
    if (myOpen !== openSeq) return;
    await openConversation(summary.conversationSid);
  } catch (error) {
    console.error('employee chat open failed', error);
    if (myEpoch !== epoch || myOpen !== openSeq) return;
    setState({
      view: 'list',
      pendingEmployee: undefined,
      loadingMessages: false,
      openError: 'Could not open the chat. Please try again.',
    });
  }
}

export async function sendChatMessage(body: string): Promise<void> {
  const { activeSid, recovery } = getState();
  const conversation = activeSid ? conversationsBySid.get(activeSid) : undefined;
  if (!activeSid || !conversation) throw new Error('No conversation is open');
  if (recovery !== undefined || !isWritable(conversation)) {
    if (recovery === undefined && isClosed(conversation)) void recoverClosedConversation(activeSid);
    throw new Error(`Conversation ${activeSid} can no longer receive messages`);
  }
  const index = await conversation.sendMessage(body);
  void advanceReadHorizon(activeSid, index);
}

async function loadCurrentPreview(sid: string, myEpoch: number): Promise<void> {
  const conversation = conversationsBySid.get(sid);
  if (!conversation) return;
  try {
    const page = await conversation.getMessages(1);
    const last = page.items[page.items.length - 1];
    if (myEpoch !== epoch || !last) return;
    const dto = toChatMessage(last, myIdentity);
    setState((state) => {
      const chat = state.chats[sid];
      if (!chat || (chat.preview && !chat.preview.fromHistory)) return {};
      return { chats: { ...state.chats, [sid]: { ...chat, preview: { body: dto.body, mine: dto.mine } } } };
    });
  } catch (error) {
    console.error('employee chat preview failed', error);
    previewsRequested.delete(sid);
  }
}

async function lastHistoryMessage(twilioClient: Client, sid: string): Promise<ChatMessage | undefined> {
  const cached = historyCache.get(sid);
  if (cached) return cached.messages[cached.messages.length - 1];
  try {
    const page = await (await twilioClient.peekConversationBySid(sid)).getMessages(1);
    const last = page.items[page.items.length - 1];
    return last ? toChatMessage(last, myIdentity) : undefined;
  } catch (error) {
    if (!isForbidden(error)) throw error;
    console.error(`employee chat history preview for ${sid} is not accessible`, error);
    return undefined;
  }
}

async function loadHistoryPreview(twilioClient: Client, sid: string, myEpoch: number): Promise<void> {
  try {
    for (const retiredSid of [...previousSidsOf(summariesBySid.get(sid))].reverse()) {
      const last = await lastHistoryMessage(twilioClient, retiredSid);
      if (myEpoch !== epoch) return;
      if (!last) continue;
      setState((state) => {
        const chat = state.chats[sid];
        if (!chat || chat.lastMessageIndex != null || chat.preview) return {};
        return {
          chats: {
            ...state.chats,
            [sid]: {
              ...chat,
              lastMessageAt: chat.lastMessageAt ?? last.dateCreated,
              preview: { body: last.body, mine: last.mine, fromHistory: true },
            },
          },
        };
      });
      return;
    }
  } catch (error) {
    console.error('employee chat history preview failed', error);
    historyPreviewsRequested.delete(sid);
  }
}

export async function loadMissingPreviews(): Promise<void> {
  const twilioClient = client;
  const myEpoch = epoch;
  const chats = Object.values(getState().chats);
  const current = chats
    .filter(
      (chat) =>
        chat.lastMessageIndex != null && (!chat.preview || chat.preview.fromHistory) && !previewsRequested.has(chat.sid)
    )
    .map((chat) => chat.sid);
  current.forEach((sid) => previewsRequested.add(sid));
  const tasks: (() => Promise<void>)[] = current.map((sid) => () => loadCurrentPreview(sid, myEpoch));
  if (twilioClient) {
    const fromHistory = chats
      .filter(
        (chat) =>
          chat.lastMessageIndex == null &&
          chat.hasHistory === true &&
          !chat.preview &&
          !historyPreviewsRequested.has(chat.sid)
      )
      .map((chat) => chat.sid);
    fromHistory.forEach((sid) => historyPreviewsRequested.add(sid));
    tasks.push(...fromHistory.map((sid) => () => loadHistoryPreview(twilioClient, sid, myEpoch)));
  }
  const worker = async (): Promise<void> => {
    for (let task = tasks.shift(); task; task = tasks.shift()) {
      await task();
    }
  };
  await Promise.all(Array.from({ length: PREVIEW_CONCURRENCY }, worker));
}
