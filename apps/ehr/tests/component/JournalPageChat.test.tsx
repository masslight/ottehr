import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { GetProviderJournalResponse } from 'utils/lib/types/api/provider-journal.types';
import { describe, expect, it, vi } from 'vitest';
import { JournalPage } from '../../src/features/journal/pages/JournalPage';

const ME = '11111111-1111-4111-8111-111111111111';
const { chatProps, refetch } = vi.hoisted(() => ({ chatProps: [] as any[], refetch: vi.fn() }));

const journal: GetProviderJournalResponse = {
  kind: 'provider',
  comingUp: [],
  today: [],
  todayDone: [],
  seenTodayCount: 0,
  recent: [],
  past: [],
  notTied: [
    {
      patient: {
        patientId: 'pat-jay',
        name: 'Jay Text',
        firstName: 'Jay',
        lastName: 'Text',
        phones: [{ number: '+14105550123', recipientResourceUri: 'RelatedPerson/rp-1' }],
        hasUnreadTexts: true,
      },
      visits: [],
      items: [
        {
          id: 'task-1',
          taskId: 'task-1',
          kind: 'text-message',
          label: 'Reply to text',
          when: 'received',
          since: new Date().toISOString(),
          patientId: 'pat-jay',
        },
      ],
    },
  ],
};

vi.mock('../../src/features/journal/hooks/useProviderJournal', () => ({
  useProviderJournal: () => ({ data: journal, isLoading: false, isError: false, refetch }),
}));
vi.mock('../../src/features/journal/hooks/useJournalOwners', () => ({
  useJournalOwners: () => ({
    owners: [{ practitionerId: ME, name: 'Ana Rivera' }],
    myPractitionerId: ME,
    isLoading: false,
  }),
}));
vi.mock('src/api/api', () => ({}));
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {}, oystehr: {} }) }));
vi.mock('../../src/layout/PageContainer', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('../../src/features/chat/ChatModal', () => ({
  default: (props: any) => {
    chatProps.push(props);
    return (
      <>
        <button onClick={() => props.onMarkAllRead()}>mark read</button>
        <button onClick={() => props.onClose()}>close chat</button>
      </>
    );
  },
}));

describe('JournalPage text chat', () => {
  it('opens the chat with the patient’s real unread state, and drops it once marked read', async () => {
    render(
      <MemoryRouter>
        <JournalPage />
      </MemoryRouter>
    );
    await userEvent.click(screen.getByText('Reply to text'));
    expect(chatProps.at(-1).appointment.smsModel.hasUnreadMessages).toBe(true);

    await userEvent.click(screen.getByText('mark read'));
    expect(chatProps.at(-1).appointment.smsModel.hasUnreadMessages).toBe(false);
  });

  it('refetches the journal when the chat closes after marking read, and not otherwise', async () => {
    render(
      <MemoryRouter>
        <JournalPage />
      </MemoryRouter>
    );
    refetch.mockClear();
    await userEvent.click(screen.getByText('Reply to text'));
    await userEvent.click(screen.getByText('close chat'));
    expect(refetch).not.toHaveBeenCalled();

    await userEvent.click(screen.getByText('Reply to text'));
    await userEvent.click(screen.getByText('mark read'));
    await userEvent.click(screen.getByText('close chat'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('JournalPage Search all patients', () => {
  it('opens the Patients page in a new tab, like the journal’s other page links', async () => {
    render(
      <MemoryRouter>
        <JournalPage />
      </MemoryRouter>
    );
    await userEvent.type(screen.getByPlaceholderText('Search patients'), 'zed');
    const link = screen.getByRole('link', { name: 'Search all patients' });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener');
  });
});
