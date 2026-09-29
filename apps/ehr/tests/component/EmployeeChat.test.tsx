import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatList } from '../../src/features/employee-chat/ChatList';
import {
  closeEmployeeChatDrawer,
  connectEmployeeChat,
  disconnectEmployeeChat,
  loadOlderMessages,
  openChatWithEmployee,
  openConversation,
  openEmployeeChatDrawer,
  sendChatMessage,
  UNREAD_PRELOAD_CAP,
} from '../../src/features/employee-chat/employee-chat.connection';
import { ChatListItem, ChatMessage, useEmployeeChatStore } from '../../src/features/employee-chat/employee-chat.store';
import {
  computeDividerIndex,
  employeeInitials,
  isUnread,
  lastSeenMessageIndex,
  splitLinks,
  unreadStartsAboveLoaded,
  upsertByIndex,
  visibleChats,
} from '../../src/features/employee-chat/employee-chat.utils';
import { EmployeeChatButton } from '../../src/features/employee-chat/EmployeeChatButton';
import { EmployeeChatDrawer } from '../../src/features/employee-chat/EmployeeChatDrawer';
import { MessageBubble } from '../../src/features/employee-chat/MessageBubble';
import { SEEN_DWELL_MS } from '../../src/features/employee-chat/useSeenMessages';

const twilio = vi.hoisted(() => {
  type Handler = (...args: any[]) => void;

  class FakeMessage {
    constructor(
      public conversation: FakeConversation,
      public index: number,
      public author: string,
      public body: string,
      public dateCreated: Date
    ) {}
    get sid(): string {
      return `${this.conversation.sid}-IM${this.index}`;
    }
  }

  class FakeConversation {
    messages: FakeMessage[] = [];
    lastReadMessageIndex: number | null = null;
    failNextSend = false;
    status: 'joined' | 'notParticipating' = 'joined';
    state: { current: 'active' | 'inactive' | 'closed' } = { current: 'active' };
    participantReadIndex: number | null = null;
    sendCalls: string[] = [];

    close(): void {
      this.participantReadIndex = this.lastReadMessageIndex;
      this.status = 'notParticipating';
      this.state = { current: 'closed' };
      this.lastReadMessageIndex = null;
    }

    async getParticipants(): Promise<any[]> {
      return [
        {
          identity: this.client.user.identity,
          lastReadMessageIndex: this.participantReadIndex ?? this.lastReadMessageIndex,
        },
      ];
    }

    constructor(
      public sid: string,
      public client: FakeClient
    ) {}

    get lastMessage(): { index: number; dateCreated: Date } | undefined {
      const last = this.messages[this.messages.length - 1];
      return last ? { index: last.index, dateCreated: last.dateCreated } : undefined;
    }

    seed(count: number, author: string): void {
      for (let i = 0; i < count; i++) this.push(author, `message ${this.messages.length}`);
    }

    push(author: string, body: string): FakeMessage {
      const message = new FakeMessage(
        this,
        this.messages.length,
        author,
        body,
        new Date(Date.UTC(2026, 8, 1, 12, this.messages.length))
      );
      this.messages.push(message);
      return message;
    }

    receive(author: string, body: string): void {
      this.client.emit('messageAdded', this.push(author, body));
    }

    page(end: number, size: number): any {
      const start = Math.max(0, end - size);
      return {
        items: this.messages.slice(start, end),
        hasPrevPage: start > 0,
        prevPage: async () => {
          const gate = this.nextPrevPageGate;
          this.nextPrevPageGate = undefined;
          const result = this.page(start, size);
          if (gate) await gate;
          return result;
        },
      };
    }

    nextGetMessagesGate: Promise<void> | undefined;
    nextPrevPageGate: Promise<void> | undefined;

    holdNextGetMessages(): () => void {
      let release!: () => void;
      this.nextGetMessagesGate = new Promise<void>((resolve) => (release = resolve));
      return release;
    }

    holdNextPrevPage(): () => void {
      let release!: () => void;
      this.nextPrevPageGate = new Promise<void>((resolve) => (release = resolve));
      return release;
    }

    async getMessages(pageSize = 30): Promise<any> {
      const gate = this.nextGetMessagesGate;
      this.nextGetMessagesGate = undefined;
      const result = this.page(this.messages.length, pageSize);
      if (gate) await gate;
      return result;
    }

    nextSendGate: Promise<void> | undefined;

    holdNextSend(): () => void {
      let release!: () => void;
      this.nextSendGate = new Promise<void>((resolve) => (release = resolve));
      return release;
    }

    async sendMessage(body: string): Promise<number> {
      this.sendCalls.push(body);
      const gate = this.nextSendGate;
      this.nextSendGate = undefined;
      if (gate) await gate;
      if (this.failNextSend) {
        this.failNextSend = false;
        throw new Error('network down');
      }
      const message = this.push(this.client.user.identity, body);
      this.client.emit('messageAdded', message);
      return message.index;
    }

    advanceCalls: number[] = [];

    async advanceLastReadMessageIndex(index: number): Promise<number> {
      this.advanceCalls.push(index);
      if (this.state.current === 'closed') {
        throw Object.assign(new Error('Bad Request'), {
          status: 400,
          body: { status: 400, code: 50377, message: "Can't update conversation as it's in final closed state" },
        });
      }
      this.lastReadMessageIndex = Math.max(this.lastReadMessageIndex ?? -1, index);
      return this.messages.filter((message) => message.index > this.lastReadMessageIndex!).length;
    }
  }

  class FakeClient {
    user = { identity: 'me-identity' };
    conversations = new Map<string, FakeConversation>();
    handlers = new Map<string, Handler[]>();

    constructor(public token: string) {
      registry.client = this;
      registry.onCreate(this);
      setTimeout(() => this.emit('initialized'), 0);
    }

    on(event: string, handler: Handler): this {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
      return this;
    }

    emit(event: string, ...args: unknown[]): void {
      (this.handlers.get(event) ?? []).forEach((handler) => handler(...args));
    }

    addConversation(sid: string): FakeConversation {
      const conversation = new FakeConversation(sid, this);
      this.conversations.set(sid, conversation);
      return conversation;
    }

    async getSubscribedConversations(): Promise<any> {
      const items = [...this.conversations.values()].filter(
        (conversation) => conversation.status === 'joined' && conversation.state.current !== 'closed'
      );
      return { items, hasNextPage: false };
    }

    peekCalls: string[] = [];

    async peekConversationBySid(sid: string): Promise<FakeConversation> {
      this.peekCalls.push(sid);
      const conversation = this.conversations.get(sid);
      if (!conversation) throw Object.assign(new Error('Forbidden'), { status: 403, body: { code: 50430 } });
      return conversation;
    }

    async getConversationBySid(sid: string): Promise<FakeConversation> {
      const conversation = this.conversations.get(sid);
      if (!conversation) throw new Error('Forbidden');
      return conversation;
    }

    async updateToken(): Promise<this> {
      return this;
    }

    async shutdown(): Promise<void> {}
  }

  const registry = {
    client: undefined as FakeClient | undefined,
    onCreate: (_client: FakeClient): void => {},
    FakeClient,
  };
  return registry;
});

vi.mock('@twilio/conversations', () => ({ Client: twilio.FakeClient }));

const mockGetEmployeeChats = vi.fn();
const mockOpenEmployeeChat = vi.fn();
const mockGetEmployees = vi.fn();

vi.mock('src/api/api', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    getEmployeeChats: (...args: any[]) => mockGetEmployeeChats(...args),
    openEmployeeChat: (...args: any[]) => mockOpenEmployeeChat(...args),
    getEmployees: (...args: any[]) => mockGetEmployees(...args),
  };
});

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehr: null, oystehrZambda: {} as any }),
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehr: null, oystehrZambda: {} as any }),
}));

const ME = 'Practitioner/me';
const BOB = { profile: 'Practitioner/bob', firstName: 'Bob', lastName: 'Chen', name: 'Bob Chen' };
const CAROL = { profile: 'Practitioner/carol', firstName: 'Carol', lastName: 'Diaz', name: 'Carol Diaz' };
const DAN = { profile: 'Practitioner/dan', firstName: 'Dan', lastName: 'Evans', name: 'Dan Evans' };

const renderChat = (): ReturnType<typeof render> => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui: ReactElement = (
    <QueryClientProvider client={queryClient}>
      <EmployeeChatButton />
      <EmployeeChatDrawer />
    </QueryClientProvider>
  );
  return render(ui);
};

const connectWith = async (setup: (client: InstanceType<typeof twilio.FakeClient>) => void): Promise<void> => {
  twilio.onCreate = setup;
  await act(async () => {
    await connectEmployeeChat({ oystehrZambda: {} as any, myProfile: ME });
  });
};

const unreadDot = (): HTMLElement =>
  screen.getByTestId('employee-chat-unread-dot').querySelector('.MuiBadge-badge') as HTMLElement;

const rect = (top: number, bottom: number): DOMRect =>
  ({ top, bottom, height: bottom - top, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;

const VIEWPORT_HEIGHT = 300;
const MESSAGE_HEIGHT = 50;

const mockLayout = (visibleThrough: () => number): void => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.dataset.testid === 'employee-chat-messages') return rect(0, VIEWPORT_HEIGHT);
    if (this.dataset.messageIndex !== undefined) {
      const bottom = VIEWPORT_HEIGHT + (Number(this.dataset.messageIndex) - visibleThrough()) * MESSAGE_HEIGHT;
      return rect(bottom - MESSAGE_HEIGHT, bottom);
    }
    return rect(0, 0);
  });
};

const DIVIDER_HEIGHT = 20;
const MESSAGES_TEST_ID = 'employee-chat-messages';
const DIVIDER_TEST_ID = 'employee-chat-new-divider';

const mockScrollLayout = (): { scrollTop: () => number } => {
  let scrollTop = 0;
  const isContainer = (element: Element): boolean => (element as HTMLElement).dataset?.testid === MESSAGES_TEST_ID;
  const heightOf = (element: HTMLElement): number => {
    if (element.dataset.messageIndex !== undefined) return MESSAGE_HEIGHT;
    if (element.dataset.testid === 'employee-chat-history-message') return MESSAGE_HEIGHT;
    if (element.dataset.testid === DIVIDER_TEST_ID) return DIVIDER_HEIGHT;
    return 0;
  };
  const children = (): HTMLElement[] =>
    Array.from(screen.queryByTestId(MESSAGES_TEST_ID)?.children ?? []) as HTMLElement[];
  const contentHeight = (): number => children().reduce((sum, child) => sum + heightOf(child), 0);
  const maxScrollTop = (): number => Math.max(0, contentHeight() - VIEWPORT_HEIGHT);

  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (isContainer(this)) return rect(0, VIEWPORT_HEIGHT);
    let top = 0;
    for (const child of children()) {
      if (child === this) return rect(top - scrollTop, top - scrollTop + heightOf(child));
      top += heightOf(child);
    }
    return rect(0, 0);
  });
  vi.spyOn(Element.prototype, 'scrollTop', 'get').mockImplementation(function (this: Element) {
    return isContainer(this) ? scrollTop : 0;
  });
  vi.spyOn(Element.prototype, 'scrollTop', 'set').mockImplementation(function (this: Element, value: number) {
    if (isContainer(this)) scrollTop = Math.min(Math.max(0, value), maxScrollTop());
  });
  vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockImplementation(function (this: Element) {
    return isContainer(this) ? contentHeight() : 0;
  });
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: Element) {
    return isContainer(this) ? VIEWPORT_HEIGHT : 0;
  });
  return { scrollTop: () => scrollTop };
};

const newDivider = (): HTMLElement | null => screen.queryByTestId(DIVIDER_TEST_ID);

const messageAfterDivider = (): string | undefined =>
  (newDivider()?.nextElementSibling as HTMLElement | null)?.dataset.messageIndex;

const mockAttention = (focused: () => boolean): void => {
  vi.spyOn(document, 'hasFocus').mockImplementation(focused);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
};

const advance = async (ms: number): Promise<void> => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

describe('employee chat utils', () => {
  it('builds initials from first and last name', () => {
    expect(employeeInitials('ana', 'lopez')).toBe('AL');
    expect(employeeInitials('Ana', '', 'Ana Maria Lopez')).toBe('AL');
    expect(employeeInitials('', '', 'Cher')).toBe('C');
    expect(employeeInitials(undefined, undefined, '')).toBe('?');
  });

  it('splits http(s) links out of plain text', () => {
    expect(splitLinks('plain')).toEqual([{ text: 'plain' }]);
    expect(splitLinks('see https://a.com/x, and http://b.org.')).toEqual([
      { text: 'see ' },
      { text: 'https://a.com/x', href: 'https://a.com/x' },
      { text: ', and ' },
      { text: 'http://b.org', href: 'http://b.org' },
      { text: '.' },
    ]);
    expect(splitLinks('(https://a.com/wiki/Foo_(bar))')).toEqual([
      { text: '(' },
      { text: 'https://a.com/wiki/Foo_(bar)', href: 'https://a.com/wiki/Foo_(bar)' },
      { text: ')' },
    ]);
    expect(splitLinks('javascript:alert(1)')).toEqual([{ text: 'javascript:alert(1)' }]);
  });

  it('upserts messages by index without duplicates', () => {
    const message = (index: number, body = `m${index}`): ChatMessage => ({
      sid: `IM${index}`,
      index,
      mine: false,
      body,
      dateCreated: undefined,
    });
    const merged = upsertByIndex([message(2), message(3)], [message(1), message(3, 'again'), message(4)]);
    expect(merged.map((m) => m.index)).toEqual([1, 2, 3, 4]);
    expect(merged[2].body).toBe('again');
  });

  it('derives unread from the last message and read horizon', () => {
    const chat = (lastMessageIndex?: number, lastReadIndex?: number | null): ChatListItem => ({
      sid: 'CH',
      otherEmployee: BOB,
      lastMessageIndex,
      lastReadIndex,
    });
    expect(isUnread(chat(undefined, null))).toBe(false);
    expect(isUnread(chat(0, null))).toBe(true);
    expect(isUnread(chat(4, 4))).toBe(false);
    expect(isUnread(chat(5, 4))).toBe(true);
  });

  it('places the divider at the first message from the other person after the read horizon', () => {
    const message = (index: number, mine = false): ChatMessage => ({
      sid: `IM${index}`,
      index,
      mine,
      body: `m${index}`,
      dateCreated: undefined,
    });
    const messages = [message(3), message(4), message(6, true), message(9)];
    expect(computeDividerIndex(messages, undefined)).toBe(3);
    expect(computeDividerIndex(messages, 3)).toBe(4);
    expect(computeDividerIndex(messages, 4)).toBe(9);
    expect(computeDividerIndex(messages, 9)).toBeUndefined();
    expect(computeDividerIndex([message(5, true)], 1)).toBeUndefined();
    expect(computeDividerIndex([], undefined)).toBeUndefined();
  });

  it('detects when unread messages may start above the loaded window', () => {
    const loaded = [{ index: 50 }, { index: 51 }];
    expect(unreadStartsAboveLoaded(loaded, true, 49)).toBe(true);
    expect(unreadStartsAboveLoaded(loaded, true, undefined)).toBe(true);
    expect(unreadStartsAboveLoaded(loaded, true, 50)).toBe(false);
    expect(unreadStartsAboveLoaded(loaded, false, 10)).toBe(false);
    expect(unreadStartsAboveLoaded([], true, undefined)).toBe(false);
  });

  it('finds the last message whose bottom edge is inside the viewport', () => {
    const at = (index: number, bottom: number): { index: number; bottom: number } => ({ index, bottom });
    expect(lastSeenMessageIndex(300, [])).toBeUndefined();
    expect(lastSeenMessageIndex(300, [at(0, 320)])).toBeUndefined();
    expect(lastSeenMessageIndex(300, [at(0, -50), at(1, 150), at(2, 300), at(3, 350)])).toBe(2);
    expect(lastSeenMessageIndex(300, [at(7, 290.5), at(4, 100)])).toBe(7);
  });

  it('shows chats with messages plus the active one, newest first', () => {
    const chats: Record<string, ChatListItem> = {
      a: { sid: 'a', otherEmployee: BOB, lastMessageIndex: 0, lastMessageAt: '2026-09-01T10:00:00.000Z' },
      b: { sid: 'b', otherEmployee: CAROL, lastMessageIndex: 3, lastMessageAt: '2026-09-02T10:00:00.000Z' },
      c: { sid: 'c', otherEmployee: DAN },
    };
    expect(visibleChats(chats, undefined).map((chat) => chat.sid)).toEqual(['b', 'a']);
    expect(visibleChats(chats, 'c').map((chat) => chat.sid)).toEqual(['b', 'a', 'c']);
  });
});

const chatRow = (name: string): HTMLElement =>
  screen.getByText(name).closest('[data-testid="employee-chat-list-item"]') as HTMLElement;

const rowUnreadDot = (name: string): HTMLElement | null => within(chatRow(name)).queryByRole('img', { name: 'Unread' });

describe('ChatList', () => {
  it('marks unread rows with a labelled dot and bold text, and leaves read rows plain', () => {
    render(
      <ChatList
        onOpen={vi.fn()}
        chats={[
          {
            sid: 'a',
            otherEmployee: BOB,
            lastMessageIndex: 5,
            lastReadIndex: 4,
            preview: { body: 'new', mine: false },
          },
          {
            sid: 'b',
            otherEmployee: CAROL,
            lastMessageIndex: 3,
            lastReadIndex: 3,
            preview: { body: 'old', mine: false },
          },
          { sid: 'c', otherEmployee: DAN, lastMessageIndex: 0, lastReadIndex: null },
        ]}
      />
    );

    expect(rowUnreadDot('Bob Chen')).toBeInTheDocument();
    expect(rowUnreadDot('Dan Evans')).toBeInTheDocument();
    expect(rowUnreadDot('Carol Diaz')).toBeNull();
    expect(screen.getByText('Bob Chen')).toHaveStyle({ fontWeight: 700 });
    expect(screen.getByText('Carol Diaz')).toHaveStyle({ fontWeight: 500 });
  });
});

describe('MessageBubble', () => {
  it('renders sender, date, time and a clickable link', () => {
    render(
      <MessageBubble
        otherName="Bob Chen"
        message={{
          sid: 'IM1',
          index: 1,
          mine: false,
          body: 'docs at https://example.com/page',
          dateCreated: '2026-09-01T15:04:00.000Z',
        }}
      />
    );
    expect(screen.getByText(/Bob Chen/)).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'https://example.com/page' });
    expect(link).toHaveAttribute('href', 'https://example.com/page');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('labels my own messages as You', () => {
    render(
      <MessageBubble
        otherName="Bob Chen"
        message={{ sid: 'IM1', index: 1, mine: true, body: 'hi', dateCreated: undefined }}
      />
    );
    expect(screen.getByText('You')).toBeInTheDocument();
  });
});

describe('employee chat flows', () => {
  beforeEach(() => {
    mockGetEmployees.mockResolvedValue({
      employees: [
        { ...BOB, status: 'Active', id: 'u-bob' },
        { ...CAROL, status: 'Active', id: 'u-carol' },
        { ...DAN, status: 'Active', id: 'u-dan' },
        { profile: ME, firstName: 'Me', lastName: 'Self', name: 'Me Self', status: 'Active', id: 'u-me' },
        {
          profile: 'Practitioner/gone',
          firstName: 'Gone',
          lastName: 'Away',
          name: 'Gone Away',
          status: 'Deactivated',
          id: 'u-gone',
        },
      ],
    });
    mockGetEmployeeChats.mockResolvedValue({
      token: 'token',
      conversations: [
        { conversationSid: 'CH-bob', otherEmployee: BOB },
        { conversationSid: 'CH-carol', otherEmployee: CAROL },
      ],
    });
  });

  afterEach(() => {
    act(() => disconnectEmployeeChat());
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  const openBobWithUnread = async (count: number): Promise<any> => {
    let bob: any;
    await connectWith((client) => {
      bob = client.addConversation('CH-bob');
      bob.seed(count, 'bob-identity');
      client.addConversation('CH-carol');
    });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    renderChat();
    act(() => openEmployeeChatDrawer());
    await act(async () => {
      await openConversation('CH-bob');
    });
    return bob;
  };

  it('does not advance the read horizon of a closed conversation opened from search', async () => {
    mockLayout(() => 2);
    mockAttention(() => true);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    let fakeClient: any;
    await connectWith((client) => {
      fakeClient = client;
      client.addConversation('CH-bob');
    });
    const carol = fakeClient.addConversation('CH-carol');
    carol.seed(3, 'carol-identity');
    carol.close();
    mockOpenEmployeeChat.mockResolvedValue({ conversation: { conversationSid: 'CH-carol', otherEmployee: CAROL } });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    renderChat();
    act(() => openEmployeeChatDrawer());

    await act(async () => {
      const opening = openChatWithEmployee(CAROL);
      await Promise.resolve();
      fakeClient.emit('conversationAdded', carol);
      await opening;
    });
    expect(useEmployeeChatStore.getState().activeSid).toBe('CH-carol');
    await advance(SEEN_DWELL_MS);

    expect(carol.advanceCalls).toEqual([]);
    expect(consoleError).not.toHaveBeenCalledWith('employee chat advance read horizon failed', expect.anything());
  });

  it('stops advancing the read horizon once the open conversation is closed or left', async () => {
    mockLayout(() => 9);
    mockAttention(() => true);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bob = await openBobWithUnread(10);

    act(() => {
      bob.close();
      twilio.client!.emit('conversationLeft', bob);
      twilio.client!.emit('conversationRemoved', bob);
    });
    await advance(SEEN_DWELL_MS);

    expect(bob.advanceCalls).toEqual([]);
    expect(consoleError).not.toHaveBeenCalledWith('employee chat advance read horizon failed', expect.anything());
  });

  it('marks messages seen only after their bottom edge stays in view for the dwell time', async () => {
    let visibleThrough = 5;
    mockLayout(() => visibleThrough);
    mockAttention(() => true);
    const bob = await openBobWithUnread(10);

    await advance(SEEN_DWELL_MS - 1);
    expect(bob.advanceCalls).toEqual([]);
    await advance(1);
    expect(bob.advanceCalls).toEqual([5]);
    expect(unreadDot()).not.toHaveClass('MuiBadge-invisible');

    visibleThrough = 9;
    fireEvent.scroll(screen.getByTestId('employee-chat-messages'));
    await advance(SEEN_DWELL_MS / 2);
    fireEvent.scroll(screen.getByTestId('employee-chat-messages'));
    await advance(SEEN_DWELL_MS - 1);
    expect(bob.advanceCalls).toEqual([5]);
    await advance(1);
    expect(bob.advanceCalls).toEqual([5, 9]);
    expect(unreadDot()).toHaveClass('MuiBadge-invisible');
  });

  it('does not mark messages seen when the drawer closes before the dwell elapses', async () => {
    mockLayout(() => 9);
    mockAttention(() => true);
    const bob = await openBobWithUnread(10);

    await advance(SEEN_DWELL_MS / 2);
    act(() => closeEmployeeChatDrawer());
    await advance(SEEN_DWELL_MS * 3);
    expect(bob.advanceCalls).toEqual([]);
  });

  it('does not mark messages seen when going back to the list before the dwell elapses', async () => {
    mockLayout(() => 9);
    mockAttention(() => true);
    const bob = await openBobWithUnread(10);

    await advance(SEEN_DWELL_MS / 2);
    fireEvent.click(screen.getByRole('button', { name: 'Back to chats' }));
    await advance(SEEN_DWELL_MS * 3);
    expect(bob.advanceCalls).toEqual([]);
  });

  it('waits for the window to be focused before marking messages seen', async () => {
    let focused = false;
    mockLayout(() => 9);
    mockAttention(() => focused);
    const bob = await openBobWithUnread(10);

    await advance(SEEN_DWELL_MS * 3);
    expect(bob.advanceCalls).toEqual([]);

    focused = true;
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await advance(SEEN_DWELL_MS / 2);
    focused = false;
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    await advance(SEEN_DWELL_MS * 3);
    expect(bob.advanceCalls).toEqual([]);

    focused = true;
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await advance(SEEN_DWELL_MS);
    expect(bob.advanceCalls).toEqual([9]);
  });

  it('marks a message that arrives while I am reading at the bottom as seen', async () => {
    let visibleThrough = 2;
    mockLayout(() => visibleThrough);
    mockAttention(() => true);
    const bob = await openBobWithUnread(3);
    await advance(SEEN_DWELL_MS);
    expect(bob.advanceCalls).toEqual([2]);

    visibleThrough = 3;
    await act(async () => {
      bob.receive('bob-identity', 'one more thing');
    });
    await advance(SEEN_DWELL_MS);
    expect(bob.advanceCalls).toEqual([2, 3]);
  });

  const connectBobAndCarol = async (): Promise<{ bob: any; carol: any }> => {
    let bob: any;
    let carol: any;
    await connectWith((client) => {
      bob = client.addConversation('CH-bob');
      bob.seed(20, 'bob-identity');
      bob.lastReadMessageIndex = 9;
      carol = client.addConversation('CH-carol');
      carol.seed(5, 'carol-identity');
      carol.lastReadMessageIndex = 4;
    });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    renderChat();
    act(() => openEmployeeChatDrawer());
    return { bob, carol };
  };

  const open = async (sid: string): Promise<void> => {
    await act(async () => {
      await openConversation(sid);
    });
  };

  const scrollToBottom = (): void => {
    const container = screen.getByTestId(MESSAGES_TEST_ID);
    container.scrollTop = container.scrollHeight;
    fireEvent.scroll(container);
  };

  it('shows the New divider above the first unread message, opens scrolled to it, and only marks what is visible', async () => {
    const layout = mockScrollLayout();
    mockAttention(() => true);
    const { bob } = await connectBobAndCarol();
    await open('CH-bob');

    expect(messageAfterDivider()).toBe('10');
    expect(within(newDivider()!).getByText('New')).toBeInTheDocument();
    expect(layout.scrollTop()).toBe(10 * MESSAGE_HEIGHT - 8);

    await advance(SEEN_DWELL_MS);
    expect(bob.advanceCalls).toEqual([14]);
  });

  it('opens at the bottom with no divider when everything has been read', async () => {
    const layout = mockScrollLayout();
    mockAttention(() => true);
    const { carol } = await connectBobAndCarol();
    carol.seed(10, 'carol-identity');
    carol.lastReadMessageIndex = 14;
    await open('CH-carol');

    expect(newDivider()).toBeNull();
    expect(layout.scrollTop()).toBe(15 * MESSAGE_HEIGHT - VIEWPORT_HEIGHT);
  });

  it('keeps the divider in place for the whole visit after reading and replying', async () => {
    mockScrollLayout();
    mockAttention(() => true);
    const { bob } = await connectBobAndCarol();
    await open('CH-bob');

    scrollToBottom();
    await advance(SEEN_DWELL_MS);
    expect(bob.lastReadMessageIndex).toBe(19);
    expect(messageAfterDivider()).toBe('10');

    const input = screen.getByTestId('employee-chat-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'caught up' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect(bob.lastReadMessageIndex).toBe(20);
    expect(messageAfterDivider()).toBe('10');
  });

  it('clears the divider on leaving and calculates a fresh one on the next entry', async () => {
    mockScrollLayout();
    mockAttention(() => true);
    const { bob } = await connectBobAndCarol();
    await open('CH-bob');
    scrollToBottom();
    await advance(SEEN_DWELL_MS);

    fireEvent.click(screen.getByRole('button', { name: 'Back to chats' }));

    await open('CH-bob');
    expect(newDivider()).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Back to chats' }));
    await act(async () => {
      bob.receive('bob-identity', 'while you were away 1');
      bob.receive('bob-identity', 'while you were away 2');
    });
    await open('CH-bob');
    expect(messageAfterDivider()).toBe('20');
  });

  it('recalculates the divider when the drawer is reopened on the same conversation', async () => {
    mockScrollLayout();
    mockAttention(() => true);
    const { bob } = await connectBobAndCarol();
    await open('CH-bob');
    scrollToBottom();
    await advance(SEEN_DWELL_MS);
    expect(bob.lastReadMessageIndex).toBe(19);

    act(() => closeEmployeeChatDrawer());
    await act(async () => {
      bob.receive('bob-identity', 'sent while the drawer was closed');
    });
    await advance(SEEN_DWELL_MS * 3);
    expect(bob.lastReadMessageIndex).toBe(19);

    act(() => openEmployeeChatDrawer());
    expect(messageAfterDivider()).toBe('20');
  });

  it('re-establishes the entry position when the drawer reopens before the list unmounts', async () => {
    const layout = mockScrollLayout();
    mockAttention(() => true);
    const { bob } = await connectBobAndCarol();
    await open('CH-bob');
    scrollToBottom();
    await advance(SEEN_DWELL_MS);
    expect(bob.advanceCalls).toEqual([19]);
    const container = screen.getByTestId(MESSAGES_TEST_ID);

    act(() => closeEmployeeChatDrawer());
    await act(async () => {
      for (let i = 0; i < 8; i++) bob.receive('bob-identity', `while closed ${i}`);
    });
    act(() => openEmployeeChatDrawer());

    expect(screen.getByTestId(MESSAGES_TEST_ID)).toBe(container);
    expect(messageAfterDivider()).toBe('20');
    expect(layout.scrollTop()).toBe(20 * MESSAGE_HEIGHT - 8);

    await advance(SEEN_DWELL_MS);
    expect(bob.advanceCalls).toEqual([19, 24]);
  });

  it('does not carry a divider over when switching conversations quickly', async () => {
    mockScrollLayout();
    mockAttention(() => true);
    await connectBobAndCarol();

    const bobOpen = openConversation('CH-bob');
    await open('CH-carol');
    await act(async () => {
      await bobOpen;
    });

    expect(screen.getByRole('heading', { name: 'Carol Diaz' })).toBeInTheDocument();
    expect(screen.getAllByTestId('employee-chat-message')).toHaveLength(5);
    expect(newDivider()).toBeNull();
  });

  it('ignores a stale load of the same conversation that resolves after a newer open', async () => {
    mockScrollLayout();
    mockAttention(() => true);
    const { bob } = await connectBobAndCarol();

    const release = bob.holdNextGetMessages();
    const staleOpen = openConversation('CH-bob');
    await open('CH-carol');
    bob.lastReadMessageIndex = 14;
    await open('CH-bob');
    expect(messageAfterDivider()).toBe('15');

    release();
    await act(async () => {
      await staleOpen;
    });
    expect(messageAfterDivider()).toBe('15');
  });

  const connectBobWithHistory = async (count: number, lastRead: number | null): Promise<any> => {
    let bob: any;
    await connectWith((client) => {
      bob = client.addConversation('CH-bob');
      bob.seed(count, 'bob-identity');
      bob.lastReadMessageIndex = lastRead;
      client.addConversation('CH-carol');
    });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    renderChat();
    act(() => openEmployeeChatDrawer());
    return bob;
  };

  const unreadAboveMarker = (): HTMLElement | null => screen.queryByTestId('employee-chat-unread-above');
  const loadedIndexes = (): number[] =>
    screen.queryAllByTestId('employee-chat-message').map((element) => Number(element.dataset.messageIndex));
  const loadEarlierButton = (): HTMLElement | null => screen.queryByRole('button', { name: 'Load earlier messages' });

  it('preloads older pages until the first unread message is loaded', async () => {
    mockScrollLayout();
    mockAttention(() => true);
    await connectBobWithHistory(120, 30);
    await open('CH-bob');

    expect(loadedIndexes()[0]).toBe(20);
    expect(loadedIndexes()).toHaveLength(100);
    expect(loadEarlierButton()).not.toBeNull();
    expect(messageAfterDivider()).toBe('31');
    expect(unreadAboveMarker()).toBeNull();
  });

  it(`stops preloading at ${UNREAD_PRELOAD_CAP} messages and marks that new messages start further up`, async () => {
    const layout = mockScrollLayout();
    mockAttention(() => true);
    const bob = await connectBobWithHistory(300, 10);
    await open('CH-bob');

    expect(loadedIndexes()).toHaveLength(UNREAD_PRELOAD_CAP);
    expect(loadedIndexes()[0]).toBe(100);
    expect(newDivider()).toBeNull();
    expect(unreadAboveMarker()).toHaveTextContent('New messages start further up');
    expect(layout.scrollTop()).toBe(0);

    await advance(SEEN_DWELL_MS * 3);
    expect(bob.advanceCalls).toEqual([]);
  });

  it('places the divider once older history reaches the boundary, without repositioning, and resumes seen tracking', async () => {
    const layout = mockScrollLayout();
    mockAttention(() => true);
    const bob = await connectBobWithHistory(300, 10);
    await open('CH-bob');
    expect(layout.scrollTop()).toBe(0);

    await act(async () => {
      await loadOlderMessages();
    });
    expect(loadedIndexes()[0]).toBe(50);
    expect(unreadAboveMarker()).not.toBeNull();
    expect(newDivider()).toBeNull();
    expect(layout.scrollTop()).toBe(50 * MESSAGE_HEIGHT);

    await act(async () => {
      await loadOlderMessages();
    });
    expect(loadedIndexes()[0]).toBe(0);
    expect(unreadAboveMarker()).toBeNull();
    expect(messageAfterDivider()).toBe('11');
    expect(layout.scrollTop()).toBe(100 * MESSAGE_HEIGHT + DIVIDER_HEIGHT);

    fireEvent.scroll(screen.getByTestId(MESSAGES_TEST_ID));
    await advance(SEEN_DWELL_MS);
    expect(bob.advanceCalls).toEqual([105]);
  });

  it('preloads the capped window for a conversation that has never been read', async () => {
    mockScrollLayout();
    mockAttention(() => true);
    await connectBobWithHistory(250, null);
    await open('CH-bob');

    expect(loadedIndexes()).toHaveLength(UNREAD_PRELOAD_CAP);
    expect(unreadAboveMarker()).not.toBeNull();
    expect(newDivider()).toBeNull();
  });

  it('still marks the conversation read through my reply while new messages start further up', async () => {
    mockScrollLayout();
    mockAttention(() => true);
    const bob = await connectBobWithHistory(300, 10);
    await open('CH-bob');

    const input = screen.getByTestId('employee-chat-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'replying without scrolling up' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect(bob.lastReadMessageIndex).toBe(300);
    expect(unreadDot()).toHaveClass('MuiBadge-invisible');
  });

  it('ignores an older-history page from a previous visit that resolves after the conversation was reopened', async () => {
    mockScrollLayout();
    mockAttention(() => true);
    const bob = await connectBobWithHistory(300, 10);
    await open('CH-bob');
    expect(loadedIndexes()[0]).toBe(100);

    const release = bob.holdNextPrevPage();
    const staleOlder = loadOlderMessages();
    fireEvent.click(screen.getByRole('button', { name: 'Back to chats' }));
    await open('CH-bob');

    release();
    await act(async () => {
      await staleOlder;
    });
    expect(loadedIndexes()[0]).toBe(100);
    expect(loadedIndexes()).toHaveLength(UNREAD_PRELOAD_CAP);
    expect(unreadAboveMarker()).not.toBeNull();

    await act(async () => {
      await loadOlderMessages();
    });
    expect(loadedIndexes()[0]).toBe(50);
  });

  const setFocus = (value: boolean, state: { focused: boolean }): void => {
    state.focused = value;
    act(() => {
      window.dispatchEvent(new Event(value ? 'focus' : 'blur'));
    });
  };

  it('places the divider above messages that arrive while the window is unfocused, and keeps them unread until focus returns', async () => {
    const attention = { focused: true };
    const layout = mockScrollLayout();
    mockAttention(() => attention.focused);
    const bob = await connectBobWithHistory(20, 19);
    await open('CH-bob');
    expect(newDivider()).toBeNull();

    setFocus(false, attention);
    await act(async () => {
      bob.receive('bob-identity', 'while you were away 1');
    });
    expect(messageAfterDivider()).toBe('20');
    expect(layout.scrollTop()).toBe(21 * MESSAGE_HEIGHT + DIVIDER_HEIGHT - VIEWPORT_HEIGHT);

    await act(async () => {
      bob.receive('bob-identity', 'while you were away 2');
    });
    expect(messageAfterDivider()).toBe('20');
    expect(layout.scrollTop()).toBe(22 * MESSAGE_HEIGHT + DIVIDER_HEIGHT - VIEWPORT_HEIGHT);

    await advance(SEEN_DWELL_MS * 3);
    expect(bob.advanceCalls).toEqual([]);

    setFocus(true, attention);
    await advance(SEEN_DWELL_MS);
    expect(bob.advanceCalls).toEqual([21]);
    expect(messageAfterDivider()).toBe('20');
  });

  it('places the divider above a message that arrives while I am scrolled up reading history', async () => {
    const layout = mockScrollLayout();
    mockAttention(() => true);
    const bob = await connectBobWithHistory(20, 19);
    await open('CH-bob');

    const container = screen.getByTestId(MESSAGES_TEST_ID);
    container.scrollTop = 0;
    fireEvent.scroll(container);
    await act(async () => {
      bob.receive('bob-identity', 'posted below');
    });

    expect(messageAfterDivider()).toBe('20');
    expect(layout.scrollTop()).toBe(0);
    await advance(SEEN_DWELL_MS * 3);
    expect(bob.advanceCalls).toEqual([]);
  });

  it('shows no divider for a message that arrives while I am following along at the bottom', async () => {
    mockScrollLayout();
    mockAttention(() => true);
    const bob = await connectBobWithHistory(20, 19);
    await open('CH-bob');

    await act(async () => {
      bob.receive('bob-identity', 'seen live');
    });
    expect(newDivider()).toBeNull();
    await advance(SEEN_DWELL_MS);
    expect(bob.advanceCalls).toEqual([20]);
  });

  it('never places the divider above my own messages', async () => {
    const attention = { focused: true };
    mockScrollLayout();
    mockAttention(() => attention.focused);
    const bob = await connectBobWithHistory(20, 19);
    await open('CH-bob');

    setFocus(false, attention);
    await act(async () => {
      bob.receive('me-identity', 'sent from my other tab');
    });
    expect(newDivider()).toBeNull();
    expect(bob.lastReadMessageIndex).toBe(20);
  });

  it('does not move the entry divider or add one under the further-up marker when messages arrive unattended', async () => {
    const attention = { focused: true };
    mockScrollLayout();
    mockAttention(() => attention.focused);
    const bob = await connectBobWithHistory(20, 9);
    await open('CH-bob');
    expect(messageAfterDivider()).toBe('10');

    setFocus(false, attention);
    await act(async () => {
      bob.receive('bob-identity', 'another one');
    });
    expect(messageAfterDivider()).toBe('10');

    fireEvent.click(screen.getByRole('button', { name: 'Back to chats' }));
    bob.seed(280, 'bob-identity');
    await open('CH-bob');
    expect(unreadAboveMarker()).not.toBeNull();
    await act(async () => {
      bob.receive('bob-identity', 'unattended under the marker');
    });
    expect(newDivider()).toBeNull();
    expect(unreadAboveMarker()).not.toBeNull();
  });

  it('keeps a message that arrives below the viewport unread', async () => {
    mockLayout(() => 2);
    mockAttention(() => true);
    const bob = await openBobWithUnread(3);
    await advance(SEEN_DWELL_MS);

    await act(async () => {
      bob.receive('bob-identity', 'below the fold');
    });
    await advance(SEEN_DWELL_MS * 3);
    expect(bob.advanceCalls).toEqual([2]);
    expect(unreadDot()).not.toHaveClass('MuiBadge-invisible');
  });

  it('lists my chats with initials and previews and flags unread', async () => {
    await connectWith((client) => {
      client.addConversation('CH-bob').seed(2, 'bob-identity');
      const carol = client.addConversation('CH-carol');
      carol.push('me-identity', 'see you');
      carol.lastReadMessageIndex = 0;
      client.addConversation('CH-legacy-team-chat').seed(3, 'someone');
    });
    renderChat();

    expect(unreadDot()).not.toHaveClass('MuiBadge-invisible');

    act(() => openEmployeeChatDrawer());
    const items = await screen.findAllByTestId('employee-chat-list-item');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('BC')).toBeInTheDocument();
    await waitFor(() => expect(within(items[0]).getByText('message 1')).toBeInTheDocument());
    expect(within(items[1]).getByText('You: see you')).toBeInTheDocument();
  });

  it.each([
    ['after the first refresh finished', false],
    ['while the first refresh is still in flight', true],
  ])('discovers a DM someone else started when its first message arrives %s', async (_case, firstRefreshInFlight) => {
    let fakeClient: any;
    await connectWith((client) => {
      fakeClient = client;
      client.addConversation('CH-bob');
      client.addConversation('CH-carol');
    });
    renderChat();
    act(() => openEmployeeChatDrawer());
    expect(unreadDot()).toHaveClass('MuiBadge-invisible');

    const known = [
      { conversationSid: 'CH-bob', otherEmployee: BOB },
      { conversationSid: 'CH-carol', otherEmployee: CAROL },
    ];
    let finishFirstRefresh = (): void => {};
    mockGetEmployeeChats.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishFirstRefresh = () => resolve({ token: 'token', conversations: known });
          if (!firstRefreshInFlight) finishFirstRefresh();
        })
    );
    const dan = fakeClient.addConversation('CH-dan');
    await act(async () => {
      fakeClient.emit('conversationJoined', dan);
    });
    expect(screen.queryByText('Dan Evans')).not.toBeInTheDocument();

    mockGetEmployeeChats.mockResolvedValue({
      token: 'token',
      conversations: [...known, { conversationSid: 'CH-dan', otherEmployee: DAN }],
    });
    await act(async () => {
      dan.receive('dan-identity', 'hi, are you free?');
    });
    await act(async () => {
      finishFirstRefresh();
    });

    await waitFor(() => expect(within(chatRow('Dan Evans')).getByText('hi, are you free?')).toBeInTheDocument());
    expect(rowUnreadDot('Dan Evans')).toBeInTheDocument();
    expect(unreadDot()).not.toHaveClass('MuiBadge-invisible');
    expect(mockGetEmployeeChats).toHaveBeenCalledTimes(3);
  });

  it('does not refresh the chat list on every message of a conversation that never becomes an employee chat', async () => {
    let legacy: any;
    await connectWith((client) => {
      client.addConversation('CH-bob');
      client.addConversation('CH-carol');
      legacy = client.addConversation('CH-legacy-team-chat');
    });
    renderChat();

    for (let i = 0; i < 10; i++) {
      await act(async () => {
        legacy.receive('someone', `team update ${i}`);
      });
    }

    expect(mockGetEmployeeChats.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('opens a conversation with the latest 50 messages and pages older history without duplicates', async () => {
    await connectWith((client) => {
      const bob = client.addConversation('CH-bob');
      bob.seed(60, 'bob-identity');
      bob.lastReadMessageIndex = 20;
      client.addConversation('CH-carol');
    });
    renderChat();
    act(() => openEmployeeChatDrawer());

    await act(async () => {
      await openConversation('CH-bob');
    });
    const renderedIndexes = (): number[] =>
      screen.getAllByTestId('employee-chat-message').map((element) => Number(element.dataset.messageIndex));
    expect(renderedIndexes()).toEqual(Array.from({ length: 50 }, (_, i) => i + 10));
    expect(screen.getByRole('button', { name: 'Load earlier messages' })).toBeInTheDocument();

    await act(async () => {
      await loadOlderMessages();
    });
    expect(renderedIndexes()).toEqual(Array.from({ length: 60 }, (_, i) => i));
    expect(screen.queryByRole('button', { name: 'Load earlier messages' })).not.toBeInTheDocument();
  });

  it('appends realtime messages to the open conversation and routes other conversations to their list row', async () => {
    let bob: any;
    let carol: any;
    await connectWith((client) => {
      bob = client.addConversation('CH-bob');
      bob.seed(1, 'bob-identity');
      bob.lastReadMessageIndex = 0;
      carol = client.addConversation('CH-carol');
    });
    renderChat();
    act(() => openEmployeeChatDrawer());
    await act(async () => {
      await openConversation('CH-bob');
    });

    await act(async () => {
      bob.receive('bob-identity', 'are you there?');
    });
    expect(screen.getByText('are you there?')).toBeInTheDocument();

    await act(async () => {
      carol.receive('carol-identity', 'ping from carol');
    });
    expect(screen.queryByText('ping from carol')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back to chats' }));
    await waitFor(() => expect(within(chatRow('Carol Diaz')).getByText('ping from carol')).toBeInTheDocument());
    expect(rowUnreadDot('Carol Diaz')).toBeInTheDocument();
  });

  it('marks the conversation read through my sent message, including earlier unread messages', async () => {
    let bob: any;
    await connectWith((client) => {
      bob = client.addConversation('CH-bob');
      bob.seed(3, 'bob-identity');
      client.addConversation('CH-carol');
    });
    renderChat();
    act(() => openEmployeeChatDrawer());
    await act(async () => {
      await openConversation('CH-bob');
    });
    expect(unreadDot()).not.toHaveClass('MuiBadge-invisible');

    const input = screen.getByTestId('employee-chat-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'on it' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    await waitFor(() => expect(unreadDot()).toHaveClass('MuiBadge-invisible'));
    expect(bob.lastReadMessageIndex).toBe(3);
    expect(bob.advanceCalls).toEqual([3]);
    expect(useEmployeeChatStore.getState().chats['CH-bob'].lastReadIndex).toBe(3);
  });

  it('marks a conversation read when my own message arrives from another session', async () => {
    let bob: any;
    await connectWith((client) => {
      bob = client.addConversation('CH-bob');
      bob.seed(2, 'bob-identity');
      client.addConversation('CH-carol');
    });
    renderChat();
    expect(unreadDot()).not.toHaveClass('MuiBadge-invisible');

    await act(async () => {
      bob.receive('me-identity', 'sent from my other tab');
    });

    await waitFor(() => expect(unreadDot()).toHaveClass('MuiBadge-invisible'));
    expect(bob.lastReadMessageIndex).toBe(2);
  });

  it('sends a message, clears the composer on success and keeps the text on failure', async () => {
    let bob: any;
    await connectWith((client) => {
      bob = client.addConversation('CH-bob');
      client.addConversation('CH-carol');
    });
    renderChat();
    act(() => openEmployeeChatDrawer());
    await act(async () => {
      await openConversation('CH-bob');
    });

    const input = screen.getByTestId('employee-chat-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'hello bob' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect(await screen.findByText('hello bob')).toBeInTheDocument();
    expect(input.value).toBe('');

    bob.failNextSend = true;
    fireEvent.change(input, { target: { value: 'will fail' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect(input.value).toBe('will fail');
    expect(screen.getByText('Message not sent. Please try again.')).toBeInTheDocument();
  });

  it('keeps a draft typed while the previous message is still sending', async () => {
    let bob: any;
    await connectWith((client) => {
      bob = client.addConversation('CH-bob');
      client.addConversation('CH-carol');
    });
    renderChat();
    act(() => openEmployeeChatDrawer());
    await act(async () => {
      await openConversation('CH-bob');
    });

    const input = screen.getByTestId('employee-chat-input') as HTMLTextAreaElement;
    const release = bob.holdNextSend();
    fireEvent.change(input, { target: { value: 'first' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect(input.value).toBe('');

    fireEvent.change(input, { target: { value: 'second draft' } });
    await act(async () => {
      release();
    });

    expect(await screen.findByText('first')).toBeInTheDocument();
    expect(input.value).toBe('second draft');
    expect(bob.sendCalls).toEqual(['first']);
  });

  it('restores a failed message ahead of the draft typed while it was sending', async () => {
    let bob: any;
    await connectWith((client) => {
      bob = client.addConversation('CH-bob');
      client.addConversation('CH-carol');
    });
    renderChat();
    act(() => openEmployeeChatDrawer());
    await act(async () => {
      await openConversation('CH-bob');
    });

    const input = screen.getByTestId('employee-chat-input') as HTMLTextAreaElement;
    bob.failNextSend = true;
    const release = bob.holdNextSend();
    fireEvent.change(input, { target: { value: 'will fail' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    fireEvent.change(input, { target: { value: 'typed meanwhile' } });
    await act(async () => {
      release();
    });

    expect(input.value).toBe('will fail\ntyped meanwhile');
    expect(screen.getByText('Message not sent. Please try again.')).toBeInTheDocument();
  });

  const selectFromSearch = async (query: string, name: RegExp): Promise<void> => {
    const search = await screen.findByTestId('employee-chat-search');
    fireEvent.change(search, { target: { value: query } });
    const option = await screen.findByRole('option', { name });
    await act(async () => {
      fireEvent.click(option);
    });
  };

  const deferOpenEmployeeChat = (): { resolve: (value: unknown) => void; reject: (error: unknown) => void } => {
    const handles = { resolve: (_value: unknown): void => {}, reject: (_error: unknown): void => {} };
    mockOpenEmployeeChat.mockImplementation(
      () =>
        new Promise((resolve, reject) => {
          handles.resolve = resolve;
          handles.reject = reject;
        })
    );
    return handles;
  };

  it('starts a new DM from search: loading state until the conversation is joined, then focuses the composer', async () => {
    let fakeClient: any;
    await connectWith((client) => {
      fakeClient = client;
      client.addConversation('CH-bob');
      client.addConversation('CH-carol');
    });
    const pending = deferOpenEmployeeChat();
    renderChat();
    act(() => openEmployeeChatDrawer());

    await selectFromSearch('Dan', /Dan Evans/);

    expect(screen.getByRole('heading', { name: 'Dan Evans' })).toBeInTheDocument();
    expect(screen.queryByTestId('employee-chat-search')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('employee-chat-messages')).getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByTestId('employee-chat-input')).toBeDisabled();
    expect(screen.getByTestId('employee-chat-input')).not.toHaveFocus();
    expect(useEmployeeChatStore.getState().activeSid).toBeUndefined();
    expect(mockOpenEmployeeChat).toHaveBeenCalledWith(expect.anything(), { targetProfile: DAN.profile });

    await act(async () => {
      pending.resolve({ conversation: { conversationSid: 'CH-dan', otherEmployee: DAN } });
    });
    expect(within(screen.getByTestId('employee-chat-messages')).getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByTestId('employee-chat-input')).toBeDisabled();

    await act(async () => {
      fakeClient.emit('conversationJoined', fakeClient.addConversation('CH-dan'));
    });

    await waitFor(() => expect(useEmployeeChatStore.getState().activeSid).toBe('CH-dan'));
    expect(screen.getByText('No messages yet')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dan Evans' })).toBeInTheDocument();
    expect(screen.getByTestId('employee-chat-input')).not.toBeDisabled();
    await waitFor(() => expect(screen.getByTestId('employee-chat-input')).toHaveFocus());
    expect(useEmployeeChatStore.getState().pendingEmployee).toBeUndefined();
  });

  it('does not take focus back from a control I moved to while the DM was being created', async () => {
    let fakeClient: any;
    await connectWith((client) => {
      fakeClient = client;
      client.addConversation('CH-bob');
      client.addConversation('CH-carol');
    });
    const pending = deferOpenEmployeeChat();
    renderChat();
    act(() => openEmployeeChatDrawer());
    await selectFromSearch('Dan', /Dan Evans/);

    const closeButton = screen.getByRole('button', { name: 'Close chats' });
    act(() => closeButton.focus());
    await act(async () => {
      fakeClient.emit('conversationJoined', fakeClient.addConversation('CH-dan'));
      pending.resolve({ conversation: { conversationSid: 'CH-dan', otherEmployee: DAN } });
    });

    await waitFor(() => expect(screen.getByTestId('employee-chat-input')).not.toBeDisabled());
    expect(closeButton).toHaveFocus();
  });

  it('returns to the chat list with the existing error when creating the conversation fails, and clears it when the drawer is reopened', async () => {
    await connectWith((client) => {
      client.addConversation('CH-bob');
      client.addConversation('CH-carol');
    });
    const pending = deferOpenEmployeeChat();
    renderChat();
    act(() => openEmployeeChatDrawer());
    await selectFromSearch('Dan', /Dan Evans/);
    expect(screen.getByRole('heading', { name: 'Dan Evans' })).toBeInTheDocument();

    await act(async () => {
      pending.reject(new Error('zambda failed'));
    });

    expect(screen.getByRole('heading', { name: 'Chats' })).toBeInTheDocument();
    expect(screen.getByText('Could not open the chat. Please try again.')).toBeInTheDocument();
    expect(screen.getByTestId('employee-chat-search')).toBeInTheDocument();
    expect(useEmployeeChatStore.getState().pendingEmployee).toBeUndefined();

    act(() => closeEmployeeChatDrawer());
    act(() => openEmployeeChatDrawer());
    expect(screen.queryByText('Could not open the chat. Please try again.')).not.toBeInTheDocument();
  });

  it('clears a failed conversation load error when going back to the chat list', async () => {
    let bob: any;
    await connectWith((client) => {
      bob = client.addConversation('CH-bob');
      client.addConversation('CH-carol');
    });
    vi.spyOn(bob, 'getMessages').mockRejectedValueOnce(new Error('network down'));
    renderChat();
    act(() => openEmployeeChatDrawer());
    await act(async () => {
      await openConversation('CH-bob');
    });
    expect(screen.getByText('Could not load messages')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back to chats' }));

    expect(screen.getByRole('heading', { name: 'Chats' })).toBeInTheDocument();
    expect(screen.queryByText('Could not load messages')).not.toBeInTheDocument();
  });

  it.each([
    ['shows the conversation when the retry succeeds', false],
    ['shows the error again when the retry fails', true],
  ])('retries a failed conversation load when the drawer is reopened and %s', async (_case, retryFails) => {
    let bob: any;
    await connectWith((client) => {
      bob = client.addConversation('CH-bob');
      bob.seed(3, 'bob-identity');
      client.addConversation('CH-carol');
    });
    renderChat();
    act(() => openEmployeeChatDrawer());
    await screen.findByText('message 2');
    const getMessages = vi.spyOn(bob, 'getMessages').mockRejectedValueOnce(new Error('network down'));
    await open('CH-bob');
    expect(screen.getByText('Could not load messages')).toBeInTheDocument();
    expect(screen.queryByText('No messages yet')).not.toBeInTheDocument();

    act(() => closeEmployeeChatDrawer());
    if (retryFails) getMessages.mockRejectedValueOnce(new Error('still down'));
    await act(async () => {
      openEmployeeChatDrawer();
    });

    expect(getMessages).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('No messages yet')).not.toBeInTheDocument();
    if (retryFails) {
      expect(screen.getByText('Could not load messages')).toBeInTheDocument();
    } else {
      expect(screen.queryByText('Could not load messages')).not.toBeInTheDocument();
      expect(screen.getAllByTestId('employee-chat-message')).toHaveLength(3);
    }
  });

  it('does not pull me back into a DM I left while it was being created, or move focus into the next chat I open', async () => {
    let fakeClient: any;
    await connectWith((client) => {
      fakeClient = client;
      client.addConversation('CH-bob');
      client.addConversation('CH-carol');
    });
    const pending = deferOpenEmployeeChat();
    renderChat();
    act(() => openEmployeeChatDrawer());
    await selectFromSearch('Dan', /Dan Evans/);

    fireEvent.click(screen.getByRole('button', { name: 'Back to chats' }));
    await act(async () => {
      fakeClient.emit('conversationJoined', fakeClient.addConversation('CH-dan'));
      pending.resolve({ conversation: { conversationSid: 'CH-dan', otherEmployee: DAN } });
    });

    expect(useEmployeeChatStore.getState().view).toBe('list');
    expect(useEmployeeChatStore.getState().activeSid).toBeUndefined();
    expect(screen.getByRole('heading', { name: 'Chats' })).toBeInTheDocument();
    expect(useEmployeeChatStore.getState().chats['CH-dan']?.otherEmployee.profile).toBe(DAN.profile);

    await act(async () => {
      await openConversation('CH-bob');
    });
    expect(screen.getByTestId('employee-chat-input')).not.toBeDisabled();
    expect(screen.getByTestId('employee-chat-input')).not.toHaveFocus();
  });

  it('opens an existing DM from search without creating a conversation', async () => {
    await connectWith((client) => {
      client.addConversation('CH-bob').seed(1, 'bob-identity');
      client.addConversation('CH-carol');
    });
    renderChat();
    act(() => openEmployeeChatDrawer());

    await selectFromSearch('Bob', /Bob Chen/);

    await waitFor(() => expect(useEmployeeChatStore.getState().activeSid).toBe('CH-bob'));
    expect(mockOpenEmployeeChat).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Bob Chen' })).toBeInTheDocument();
  });

  it('excludes myself and deactivated employees from search', async () => {
    await connectWith((client) => {
      client.addConversation('CH-bob');
      client.addConversation('CH-carol');
    });
    renderChat();
    act(() => openEmployeeChatDrawer());

    const search = await screen.findByTestId('employee-chat-search');
    fireEvent.mouseDown(search);
    fireEvent.change(search, { target: { value: 'e' } });
    await screen.findByRole('option', { name: /Dan Evans/ });
    expect(screen.queryByRole('option', { name: /Me Self/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Gone Away/ })).not.toBeInTheDocument();
  });

  it('clears the row dot when the read horizon advances from another session and restores it on a new message', async () => {
    let fakeClient: any;
    let bob: any;
    await connectWith((client) => {
      fakeClient = client;
      bob = client.addConversation('CH-bob');
      bob.seed(2, 'bob-identity');
      const carol = client.addConversation('CH-carol');
      carol.seed(1, 'carol-identity');
      carol.lastReadMessageIndex = 0;
    });
    renderChat();
    act(() => openEmployeeChatDrawer());
    await screen.findByText('Bob Chen');
    expect(rowUnreadDot('Bob Chen')).toBeInTheDocument();
    expect(rowUnreadDot('Carol Diaz')).toBeNull();

    bob.lastReadMessageIndex = 1;
    act(() => {
      fakeClient.emit('conversationUpdated', { conversation: bob, updateReasons: ['lastReadMessageIndex'] });
    });
    expect(rowUnreadDot('Bob Chen')).toBeNull();
    expect(unreadDot()).toHaveClass('MuiBadge-invisible');

    await act(async () => {
      bob.receive('bob-identity', 'one more thing');
    });
    expect(rowUnreadDot('Bob Chen')).toBeInTheDocument();
    expect(unreadDot()).not.toHaveClass('MuiBadge-invisible');
  });

  it('clears the row dot after I read the conversation in the drawer', async () => {
    mockScrollLayout();
    mockAttention(() => true);
    await connectBobWithHistory(3, null);
    expect(rowUnreadDot('Bob Chen')).toBeInTheDocument();

    await open('CH-bob');
    await advance(SEEN_DWELL_MS);
    fireEvent.click(screen.getByRole('button', { name: 'Back to chats' }));

    expect(rowUnreadDot('Bob Chen')).toBeNull();
    expect(screen.getByText('Bob Chen')).toHaveStyle({ fontWeight: 500 });
  });
  describe('environment without Oystehr Conversations', () => {
    const apiFailure = (code: number, message: string): Error =>
      new Error(JSON.stringify({ name: 'OystehrSdkError', message, code }));

    it('explains that chat is unavailable instead of offering a retry', async () => {
      mockGetEmployeeChats.mockRejectedValue(
        apiFailure(5000, 'Oystehr Conversations is not configured for this project, so employee chat is unavailable')
      );
      vi.spyOn(console, 'error').mockImplementation(() => {});
      await act(async () => {
        await connectEmployeeChat({ oystehrZambda: {} as any, myProfile: ME });
      });
      renderChat();
      act(() => openEmployeeChatDrawer());

      expect(useEmployeeChatStore.getState().status).toBe('unavailable');
      expect(screen.getByTestId('employee-chat-unavailable')).toHaveTextContent(
        "Chat isn't available in this environment."
      );
      expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
      expect(screen.getByTestId('employee-chat-search')).toBeDisabled();
    });

    it('still reports other connection failures as retryable errors', async () => {
      mockGetEmployeeChats.mockRejectedValue(apiFailure(500, 'Internal error'));
      vi.spyOn(console, 'error').mockImplementation(() => {});
      await act(async () => {
        await connectEmployeeChat({ oystehrZambda: {} as any, myProfile: ME });
      });
      renderChat();
      act(() => openEmployeeChatDrawer());

      expect(useEmployeeChatStore.getState().status).toBe('error');
      expect(screen.queryByTestId('employee-chat-unavailable')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });
  });

  describe('closed conversation recovery', () => {
    const summaryOf = (sid: string, employee: typeof BOB, previous: string[] = []): any => ({
      conversationSid: sid,
      previousConversationSids: previous,
      otherEmployee: employee,
    });

    const historyMessages = (): HTMLElement[] => screen.queryAllByTestId('employee-chat-history-message');
    const currentMessages = (): HTMLElement[] => screen.queryAllByTestId('employee-chat-message');
    const chatSids = (): string[] => Object.keys(useEmployeeChatStore.getState().chats).sort();

    const connectWithClosedBob = async (): Promise<{ fakeClient: any; bob: any }> => {
      let fakeClient: any;
      let bob: any;
      await connectWith((client) => {
        fakeClient = client;
        bob = client.addConversation('CH-bob');
        bob.seed(3, 'bob-identity');
        bob.lastReadMessageIndex = 1;
        bob.close();
        client.addConversation('CH-carol');
      });
      await waitFor(() => expect(useEmployeeChatStore.getState().chats['CH-bob']?.closed).toBe(true));
      return { fakeClient, bob };
    };

    it('keeps a closed chat in the list after reconnecting, using my participant read horizon', async () => {
      const { fakeClient, bob } = await connectWithClosedBob();
      renderChat();
      act(() => openEmployeeChatDrawer());

      expect(await screen.findByText('Bob Chen')).toBeInTheDocument();
      expect(fakeClient.peekCalls).toEqual(['CH-bob']);
      expect(useEmployeeChatStore.getState().chats['CH-bob'].lastReadIndex).toBe(1);
      expect(rowUnreadDot('Bob Chen')).toBeInTheDocument();
      expect(mockOpenEmployeeChat).not.toHaveBeenCalled();
      expect(bob.advanceCalls).toEqual([]);
    });

    it('replaces a closed conversation when it is opened and keeps its messages as read-only history', async () => {
      const { fakeClient, bob } = await connectWithClosedBob();
      const pending = deferOpenEmployeeChat();
      renderChat();
      act(() => openEmployeeChatDrawer());
      fireEvent.click(await screen.findByText('Bob Chen'));

      await waitFor(() =>
        expect(mockOpenEmployeeChat).toHaveBeenCalledWith(expect.anything(), {
          targetProfile: BOB.profile,
          replaceClosedConversationSid: 'CH-bob',
        })
      );
      expect(screen.getByTestId('employee-chat-recovering')).toBeInTheDocument();
      expect(screen.getByTestId('employee-chat-input')).toBeDisabled();
      expect(screen.getByRole('heading', { name: 'Bob Chen' })).toBeInTheDocument();
      await waitFor(() => expect(historyMessages()).toHaveLength(3));
      expect(currentMessages()).toHaveLength(0);

      await act(async () => {
        pending.resolve({ conversation: summaryOf('CH-bob2', BOB, ['CH-bob']) });
      });
      await act(async () => {
        fakeClient.emit('conversationJoined', fakeClient.addConversation('CH-bob2'));
      });

      await waitFor(() => expect(useEmployeeChatStore.getState().activeSid).toBe('CH-bob2'));
      await waitFor(() => expect(historyMessages()).toHaveLength(3));
      expect(screen.queryByText('Earlier messages')).not.toBeInTheDocument();
      expect(screen.queryByTestId('employee-chat-recovering')).not.toBeInTheDocument();
      expect(screen.getByTestId('employee-chat-input')).not.toBeDisabled();
      expect(chatSids()).toEqual(['CH-bob2', 'CH-carol']);
      expect(mockOpenEmployeeChat).toHaveBeenCalledTimes(1);
      expect(bob.advanceCalls).toEqual([]);
      expect(bob.sendCalls).toEqual([]);
    });

    it('leaves history readable and offers Retry when the replacement fails', async () => {
      const { fakeClient, bob } = await connectWithClosedBob();
      mockOpenEmployeeChat.mockRejectedValueOnce(new Error('FHIR unavailable'));
      renderChat();
      act(() => openEmployeeChatDrawer());
      fireEvent.click(await screen.findByText('Bob Chen'));

      expect(await screen.findByTestId('employee-chat-recovery-failed')).toBeInTheDocument();
      expect(historyMessages()).toHaveLength(3);
      expect(screen.getByTestId('employee-chat-input')).toBeDisabled();
      expect(screen.queryByText('No messages yet')).not.toBeInTheDocument();

      mockOpenEmployeeChat.mockImplementationOnce(async () => {
        fakeClient.emit('conversationJoined', fakeClient.addConversation('CH-bob2'));
        return { conversation: summaryOf('CH-bob2', BOB, ['CH-bob']) };
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      });

      await waitFor(() => expect(useEmployeeChatStore.getState().activeSid).toBe('CH-bob2'));
      expect(screen.queryByTestId('employee-chat-recovery-failed')).not.toBeInTheDocument();
      expect(historyMessages()).toHaveLength(3);
      expect(screen.getByTestId('employee-chat-input')).not.toBeDisabled();
      expect(bob.advanceCalls).toEqual([]);
    });

    it('settles on the canonical replacement when the other employee replaced the chat first', async () => {
      const { fakeClient } = await connectWithClosedBob();
      const pending = deferOpenEmployeeChat();
      renderChat();
      act(() => openEmployeeChatDrawer());
      fireEvent.click(await screen.findByText('Bob Chen'));
      await waitFor(() => expect(mockOpenEmployeeChat).toHaveBeenCalledTimes(1));

      mockGetEmployeeChats.mockResolvedValue({
        token: 'token',
        conversations: [summaryOf('CH-bob2', BOB, ['CH-bob']), summaryOf('CH-carol', CAROL)],
      });
      await act(async () => {
        fakeClient.emit('conversationJoined', fakeClient.addConversation('CH-bob2'));
      });
      await waitFor(() => expect(chatSids()).toEqual(['CH-bob2', 'CH-carol']));
      expect(screen.getByRole('heading', { name: 'Bob Chen' })).toBeInTheDocument();
      expect(useEmployeeChatStore.getState().activeSid).toBe('CH-bob');

      await act(async () => {
        pending.resolve({ conversation: summaryOf('CH-bob2', BOB, ['CH-bob']) });
      });

      await waitFor(() => expect(useEmployeeChatStore.getState().activeSid).toBe('CH-bob2'));
      expect(chatSids()).toEqual(['CH-bob2', 'CH-carol']);
      expect(mockOpenEmployeeChat).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('employee-chat-input')).not.toBeDisabled();
    });

    it('starts recovery when the open conversation closes, and only marks other chats closed', async () => {
      let bob: any;
      let carol: any;
      let fakeClient: any;
      await connectWith((client) => {
        fakeClient = client;
        bob = client.addConversation('CH-bob');
        bob.seed(2, 'bob-identity');
        carol = client.addConversation('CH-carol');
        carol.seed(1, 'carol-identity');
      });
      deferOpenEmployeeChat();
      renderChat();
      act(() => openEmployeeChatDrawer());
      await act(async () => {
        await openConversation('CH-bob');
      });
      expect(currentMessages()).toHaveLength(2);

      carol.close();
      act(() => {
        fakeClient.emit('conversationUpdated', { conversation: carol, updateReasons: ['state'] });
      });
      expect(useEmployeeChatStore.getState().chats['CH-carol'].closed).toBe(true);
      expect(mockOpenEmployeeChat).not.toHaveBeenCalled();

      bob.close();
      await act(async () => {
        fakeClient.emit('conversationUpdated', { conversation: bob, updateReasons: ['state'] });
      });

      await waitFor(() =>
        expect(mockOpenEmployeeChat).toHaveBeenCalledWith(expect.anything(), {
          targetProfile: BOB.profile,
          replaceClosedConversationSid: 'CH-bob',
        })
      );
      expect(mockOpenEmployeeChat).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('employee-chat-input')).toBeDisabled();
      await waitFor(() => expect(historyMessages()).toHaveLength(2));
      expect(currentMessages()).toHaveLength(0);
      expect(bob.advanceCalls).toEqual([]);
    });

    it('treats a conversation removed while closed as history and only recovers the open chat', async () => {
      let carol: any;
      let fakeClient: any;
      await connectWith((client) => {
        fakeClient = client;
        client.addConversation('CH-bob').seed(1, 'bob-identity');
        carol = client.addConversation('CH-carol');
        carol.seed(1, 'carol-identity');
      });
      renderChat();
      act(() => openEmployeeChatDrawer());
      await act(async () => {
        await openConversation('CH-bob');
      });

      carol.close();
      act(() => {
        fakeClient.emit('conversationLeft', carol);
        fakeClient.emit('conversationRemoved', carol);
      });

      expect(useEmployeeChatStore.getState().chats['CH-carol'].closed).toBe(true);
      expect(mockOpenEmployeeChat).not.toHaveBeenCalled();
      expect(useEmployeeChatStore.getState().activeSid).toBe('CH-bob');
    });

    it('drops a conversation I was removed from without leaving it writable', async () => {
      let bob: any;
      let fakeClient: any;
      await connectWith((client) => {
        fakeClient = client;
        bob = client.addConversation('CH-bob');
        bob.seed(1, 'bob-identity');
        client.addConversation('CH-carol');
      });
      renderChat();
      act(() => openEmployeeChatDrawer());
      await act(async () => {
        await openConversation('CH-bob');
      });
      const refreshesBefore = mockGetEmployeeChats.mock.calls.length;

      bob.status = 'notParticipating';
      await act(async () => {
        fakeClient.emit('conversationLeft', bob);
        fakeClient.emit('conversationRemoved', bob);
      });

      await waitFor(() => expect(mockGetEmployeeChats.mock.calls.length).toBe(refreshesBefore + 1));
      expect(useEmployeeChatStore.getState().chats['CH-bob']).toBeUndefined();
      expect(screen.getByText('This chat is no longer available.')).toBeInTheDocument();
      expect(screen.getByTestId('employee-chat-input')).toBeDisabled();
      await expect(sendChatMessage('still there?')).rejects.toThrow();
      expect(bob.sendCalls).toEqual([]);
      expect(mockOpenEmployeeChat).not.toHaveBeenCalled();
    });

    it('moves an open chat to the replacement the other employee created, keeping the old one as history', async () => {
      let bob: any;
      let fakeClient: any;
      await connectWith((client) => {
        fakeClient = client;
        bob = client.addConversation('CH-bob');
        bob.seed(2, 'bob-identity');
        client.addConversation('CH-carol');
      });
      renderChat();
      act(() => openEmployeeChatDrawer());
      await act(async () => {
        await openConversation('CH-bob');
      });

      bob.close();
      mockGetEmployeeChats.mockResolvedValue({
        token: 'token',
        conversations: [summaryOf('CH-bob2', BOB, ['CH-bob']), summaryOf('CH-carol', CAROL)],
      });
      await act(async () => {
        fakeClient.emit('conversationJoined', fakeClient.addConversation('CH-bob2'));
      });

      await waitFor(() => expect(useEmployeeChatStore.getState().activeSid).toBe('CH-bob2'));
      await waitFor(() => expect(historyMessages()).toHaveLength(2));
      expect(currentMessages()).toHaveLength(0);
      expect(chatSids()).toEqual(['CH-bob2', 'CH-carol']);
      expect(screen.getByRole('heading', { name: 'Bob Chen' })).toBeInTheDocument();
      expect(screen.getByTestId('employee-chat-input')).not.toBeDisabled();
      expect(mockOpenEmployeeChat).not.toHaveBeenCalled();
      await expect(sendChatMessage('on the new one')).resolves.toBeUndefined();
      expect(bob.sendCalls).toEqual([]);
    });

    it('never sends to a conversation that closed without an event, and recovers instead', async () => {
      let bob: any;
      await connectWith((client) => {
        bob = client.addConversation('CH-bob');
        client.addConversation('CH-carol');
      });
      deferOpenEmployeeChat();
      renderChat();
      act(() => openEmployeeChatDrawer());
      await act(async () => {
        await openConversation('CH-bob');
      });

      bob.close();
      await expect(sendChatMessage('hello?')).rejects.toThrow();

      expect(bob.sendCalls).toEqual([]);
      await waitFor(() =>
        expect(mockOpenEmployeeChat).toHaveBeenCalledWith(expect.anything(), {
          targetProfile: BOB.profile,
          replaceClosedConversationSid: 'CH-bob',
        })
      );
      await expect(sendChatMessage('hello?')).rejects.toThrow();
      expect(bob.sendCalls).toEqual([]);
    });

    it('loads retired history lazily after a reload, isolated from the current conversation indices and read horizon', async () => {
      let fakeClient: any;
      let retired: any;
      let current: any;
      mockGetEmployeeChats.mockResolvedValue({
        token: 'token',
        conversations: [summaryOf('CH-bob2', BOB, ['CH-bob']), summaryOf('CH-carol', CAROL)],
      });
      await connectWith((client) => {
        fakeClient = client;
        retired = client.addConversation('CH-bob');
        retired.seed(3, 'bob-identity');
        retired.close();
        current = client.addConversation('CH-bob2');
        current.seed(1, 'bob-identity');
        client.addConversation('CH-carol');
      });
      mockLayout(() => 0);
      mockAttention(() => true);
      renderChat();
      act(() => openEmployeeChatDrawer());
      expect(chatSids()).toEqual(['CH-bob2', 'CH-carol']);
      expect(fakeClient.peekCalls).toEqual([]);

      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      await act(async () => {
        await openConversation('CH-bob2');
      });

      expect(fakeClient.peekCalls).toEqual(['CH-bob']);
      expect(historyMessages()).toHaveLength(3);
      historyMessages().forEach((message) => expect(message).not.toHaveAttribute('data-message-index'));
      expect(currentMessages().map((message) => message.dataset.messageIndex)).toEqual(['0']);
      expect(screen.getByTestId('employee-chat-input')).not.toBeDisabled();

      await advance(SEEN_DWELL_MS);
      expect(current.advanceCalls).toEqual([0]);
      expect(retired.advanceCalls).toEqual([]);
      expect(mockOpenEmployeeChat).not.toHaveBeenCalled();

      await act(async () => {
        current.receive('bob-identity', 'new message');
      });
      expect(currentMessages().map((message) => message.dataset.messageIndex)).toEqual(['0', '1']);
      expect(historyMessages()).toHaveLength(3);
    });

    it('renders several retired conversations as one continuous chronological history above the current one', async () => {
      mockGetEmployeeChats.mockResolvedValue({
        token: 'token',
        conversations: [summaryOf('CH-bob3', BOB, ['CH-bob1', 'CH-bob2']), summaryOf('CH-carol', CAROL)],
      });
      await connectWith((client) => {
        const first = client.addConversation('CH-bob1');
        first.push('bob-identity', 'first a');
        first.push('me-identity', 'first b');
        first.close();
        const second = client.addConversation('CH-bob2');
        second.push('bob-identity', 'second a');
        second.push('me-identity', 'second b');
        second.close();
        const current = client.addConversation('CH-bob3');
        current.push('bob-identity', 'current a');
        client.addConversation('CH-carol');
      });
      renderChat();
      act(() => openEmployeeChatDrawer());
      await act(async () => {
        await openConversation('CH-bob3');
      });

      const bodies = (): string[] =>
        Array.from(
          screen
            .getByTestId('employee-chat-messages')
            .querySelectorAll('[data-testid="employee-chat-history-message"], [data-testid="employee-chat-message"]'),
          (element) => element.textContent ?? ''
        );
      expect(bodies()).toEqual([
        expect.stringContaining('second a'),
        expect.stringContaining('second b'),
        expect.stringContaining('current a'),
      ]);
      expect(screen.queryByText('No messages yet')).not.toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Load earlier messages' }));
      });

      expect(bodies()).toEqual([
        expect.stringContaining('first a'),
        expect.stringContaining('first b'),
        expect.stringContaining('second a'),
        expect.stringContaining('second b'),
        expect.stringContaining('current a'),
      ]);
      const container = screen.getByTestId('employee-chat-messages');
      expect(Array.from(container.children, (child) => (child as HTMLElement).dataset.testid)).toEqual([
        'employee-chat-history-message',
        'employee-chat-history-message',
        'employee-chat-history-message',
        'employee-chat-history-message',
        DIVIDER_TEST_ID,
        'employee-chat-message',
      ]);
      expect(within(container).getAllByRole('separator')).toEqual([newDivider()]);
      expect(screen.queryByText('Earlier messages')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Load earlier messages' })).not.toBeInTheDocument();
    });

    it('loads retired history above an unread boundary without moving, recreating or extending the New divider', async () => {
      const layout = mockScrollLayout();
      mockAttention(() => true);
      let retired: any;
      let current: any;
      mockGetEmployeeChats.mockResolvedValue({
        token: 'token',
        conversations: [summaryOf('CH-bob2', BOB, ['CH-bob']), summaryOf('CH-carol', CAROL)],
      });
      await connectWith((client) => {
        retired = client.addConversation('CH-bob');
        retired.seed(3, 'bob-identity');
        retired.close();
        current = client.addConversation('CH-bob2');
        current.seed(10, 'bob-identity');
        current.lastReadMessageIndex = 5;
        client.addConversation('CH-carol');
      });
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      renderChat();
      act(() => openEmployeeChatDrawer());
      const releaseHistory = retired.holdNextGetMessages();

      let opening!: Promise<void>;
      await act(async () => {
        opening = openConversation('CH-bob2');
        await Promise.resolve();
      });
      await act(async () => {
        await vi.waitFor(() => expect(messageAfterDivider()).toBe('6'));
      });
      const entryBefore = useEmployeeChatStore.getState().unreadEntry;
      const dividerTopBefore = newDivider()!.getBoundingClientRect().top;
      const scrollBefore = layout.scrollTop();
      expect(historyMessages()).toHaveLength(0);

      await act(async () => {
        releaseHistory();
        await opening;
      });

      expect(historyMessages()).toHaveLength(3);
      historyMessages().forEach((message) => expect(message).not.toHaveAttribute('data-message-index'));
      expect(useEmployeeChatStore.getState().unreadEntry).toBe(entryBefore);
      expect(screen.getAllByTestId(DIVIDER_TEST_ID)).toHaveLength(1);
      expect(messageAfterDivider()).toBe('6');
      expect(layout.scrollTop()).toBe(scrollBefore + 3 * MESSAGE_HEIGHT);
      expect(newDivider()!.getBoundingClientRect().top).toBe(dividerTopBefore);

      await advance(SEEN_DWELL_MS);
      expect(retired.advanceCalls).toEqual([]);
      expect(current.advanceCalls).toEqual([9]);
      expect(messageAfterDivider()).toBe('6');
      expect(useEmployeeChatStore.getState().chats['CH-bob2'].lastReadIndex).toBe(9);
    });
  });
});
