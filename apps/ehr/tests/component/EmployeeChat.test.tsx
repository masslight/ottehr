import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeEmployeeChatDrawer,
  connectEmployeeChat,
  disconnectEmployeeChat,
  loadOlderMessages,
  openChatWithEmployee,
  openConversation,
  openEmployeeChatDrawer,
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

    async sendMessage(body: string): Promise<number> {
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
      return { items: [...this.conversations.values()], hasNextPage: false };
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
    expect(useEmployeeChatStore.getState().unreadEntry).toBeUndefined();

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
    expect(useEmployeeChatStore.getState().unreadEntry).toBeUndefined();
    await act(async () => {
      bob.receive('bob-identity', 'sent while the drawer was closed');
    });
    await advance(SEEN_DWELL_MS * 3);
    expect(bob.lastReadMessageIndex).toBe(19);

    act(() => openEmployeeChatDrawer());
    expect(useEmployeeChatStore.getState().unreadEntry).toMatchObject({ sid: 'CH-bob', dividerIndex: 20 });
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

    expect(useEmployeeChatStore.getState().activeSid).toBe('CH-carol');
    expect(useEmployeeChatStore.getState().unreadEntry).toMatchObject({ sid: 'CH-carol', dividerIndex: undefined });
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
    expect(useEmployeeChatStore.getState().unreadEntry).toMatchObject({ sid: 'CH-bob', dividerIndex: 15 });

    release();
    await act(async () => {
      await staleOpen;
    });
    expect(useEmployeeChatStore.getState().unreadEntry).toMatchObject({ sid: 'CH-bob', dividerIndex: 15 });
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
  const loadedIndexes = (): number[] => useEmployeeChatStore.getState().messages.map((m) => m.index);

  it('preloads older pages until the first unread message is loaded', async () => {
    mockScrollLayout();
    mockAttention(() => true);
    await connectBobWithHistory(120, 30);
    await open('CH-bob');

    expect(loadedIndexes()[0]).toBe(20);
    expect(loadedIndexes()).toHaveLength(100);
    expect(useEmployeeChatStore.getState().hasOlderMessages).toBe(true);
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
    const entryId = useEmployeeChatStore.getState().unreadEntry?.id;

    await act(async () => {
      await loadOlderMessages();
    });
    expect(loadedIndexes()[0]).toBe(50);
    expect(unreadAboveMarker()).not.toBeNull();
    expect(newDivider()).toBeNull();

    const scrollTopBefore = layout.scrollTop();
    await act(async () => {
      await loadOlderMessages();
    });
    expect(loadedIndexes()[0]).toBe(0);
    expect(unreadAboveMarker()).toBeNull();
    expect(messageAfterDivider()).toBe('11');
    expect(useEmployeeChatStore.getState().unreadEntry?.id).toBe(entryId);
    expect(layout.scrollTop()).toBeGreaterThan(scrollTopBefore);

    fireEvent.scroll(screen.getByTestId(MESSAGES_TEST_ID));
    await advance(SEEN_DWELL_MS);
    expect(bob.advanceCalls).toHaveLength(1);
    expect(bob.advanceCalls[0]).toBeGreaterThan(10);
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
    const freshEntry = useEmployeeChatStore.getState().unreadEntry;

    release();
    await act(async () => {
      await staleOlder;
    });
    expect(loadedIndexes()[0]).toBe(100);
    expect(loadedIndexes()).toHaveLength(UNREAD_PRELOAD_CAP);
    expect(useEmployeeChatStore.getState().unreadEntry).toEqual(freshEntry);
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

  it('opens a conversation with the latest 50 messages without marking it read, and pages older without duplicates', async () => {
    let bob: any;
    await connectWith((client) => {
      bob = client.addConversation('CH-bob');
      bob.seed(60, 'bob-identity');
      bob.lastReadMessageIndex = 20;
      client.addConversation('CH-carol');
    });
    renderChat();
    act(() => openEmployeeChatDrawer());

    await act(async () => {
      await openConversation('CH-bob');
    });
    expect(screen.getAllByTestId('employee-chat-message')).toHaveLength(50);
    expect(unreadDot()).not.toHaveClass('MuiBadge-invisible');
    expect(bob.lastReadMessageIndex).toBe(20);
    expect(bob.advanceCalls).toEqual([]);

    await act(async () => {
      await loadOlderMessages();
    });
    const indexes = useEmployeeChatStore.getState().messages.map((m) => m.index);
    expect(indexes).toHaveLength(60);
    expect(new Set(indexes).size).toBe(60);
    expect(useEmployeeChatStore.getState().hasOlderMessages).toBe(false);
  });

  it('appends realtime messages to the open conversation without marking them read', async () => {
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
    expect(unreadDot()).toHaveClass('MuiBadge-invisible');

    await act(async () => {
      bob.receive('bob-identity', 'are you there?');
    });
    expect(screen.getByText('are you there?')).toBeInTheDocument();
    expect(bob.lastReadMessageIndex).toBe(0);
    expect(unreadDot()).not.toHaveClass('MuiBadge-invisible');

    await act(async () => {
      carol.receive('carol-identity', 'ping from carol');
    });
    expect(screen.queryByText('ping from carol')).not.toBeInTheDocument();
    expect(useEmployeeChatStore.getState().chats['CH-carol'].lastMessageIndex).toBe(0);
    expect(carol.lastReadMessageIndex).toBeNull();
  });

  it('does not mark the active conversation read when the drawer is reopened', async () => {
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
    act(() => closeEmployeeChatDrawer());
    act(() => openEmployeeChatDrawer());

    expect(bob.advanceCalls).toEqual([]);
    expect(unreadDot()).not.toHaveClass('MuiBadge-invisible');
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
    expect(unreadDot()).toHaveClass('MuiBadge-invisible');

    bob.failNextSend = true;
    fireEvent.change(input, { target: { value: 'will fail' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect(input.value).toBe('will fail');
    expect(screen.getByText('Message not sent. Please try again.')).toBeInTheDocument();
  });

  it('starts a new conversation from employee search', async () => {
    let fakeClient: any;
    await connectWith((client) => {
      fakeClient = client;
      client.addConversation('CH-bob');
      client.addConversation('CH-carol');
    });
    mockOpenEmployeeChat.mockImplementation(async () => {
      const conversation = fakeClient.addConversation('CH-dan');
      setTimeout(() => fakeClient.emit('conversationJoined', conversation), 0);
      return { conversation: { conversationSid: 'CH-dan', otherEmployee: DAN } };
    });
    renderChat();
    act(() => openEmployeeChatDrawer());

    const search = await screen.findByTestId('employee-chat-search');
    fireEvent.change(search, { target: { value: 'Dan' } });
    const option = await screen.findByRole('option', { name: /Dan Evans/ });
    await act(async () => {
      fireEvent.click(option);
    });

    await waitFor(() => expect(useEmployeeChatStore.getState().activeSid).toBe('CH-dan'));
    expect(mockOpenEmployeeChat).toHaveBeenCalledWith(expect.anything(), { targetProfile: DAN.profile });
    expect(screen.getByText('No messages yet')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dan Evans' })).toBeInTheDocument();
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

  it('reuses the existing conversation when selecting someone I already chat with', async () => {
    await connectWith((client) => {
      client.addConversation('CH-bob').seed(1, 'bob-identity');
      client.addConversation('CH-carol');
    });
    await act(async () => {
      await openChatWithEmployee(BOB.profile);
    });
    expect(mockOpenEmployeeChat).not.toHaveBeenCalled();
    expect(useEmployeeChatStore.getState().activeSid).toBe('CH-bob');
  });
});
