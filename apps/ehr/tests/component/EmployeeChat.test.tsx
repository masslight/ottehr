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
} from '../../src/features/employee-chat/employee-chat.connection';
import { ChatListItem, ChatMessage, useEmployeeChatStore } from '../../src/features/employee-chat/employee-chat.store';
import {
  employeeInitials,
  isUnread,
  splitLinks,
  upsertByIndex,
  visibleChats,
} from '../../src/features/employee-chat/employee-chat.utils';
import { EmployeeChatButton } from '../../src/features/employee-chat/EmployeeChatButton';
import { EmployeeChatDrawer } from '../../src/features/employee-chat/EmployeeChatDrawer';
import { MessageBubble } from '../../src/features/employee-chat/MessageBubble';

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
        prevPage: async () => this.page(start, size),
      };
    }

    async getMessages(pageSize = 30): Promise<any> {
      return this.page(this.messages.length, pageSize);
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
    vi.clearAllMocks();
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
      client.addConversation('CH-carol');
    });
    renderChat();
    act(() => openEmployeeChatDrawer());

    await act(async () => {
      await openConversation('CH-bob');
    });
    expect(screen.getAllByTestId('employee-chat-message')).toHaveLength(50);
    expect(unreadDot()).not.toHaveClass('MuiBadge-invisible');
    expect(bob.lastReadMessageIndex).toBeNull();
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
