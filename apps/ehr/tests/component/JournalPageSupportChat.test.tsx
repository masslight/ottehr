import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { GetProviderJournalResponse, JournalItem } from 'utils/lib/types/api/provider-journal.types';
import { PATIENT_REQUEST_TASK } from 'utils/lib/types/data/tasks/types';
import { describe, expect, it, vi } from 'vitest';
import { JournalPage } from '../../src/features/journal/pages/JournalPage';

const ME = '11111111-1111-4111-8111-111111111111';
const TASK_ID = '22222222-2222-4222-8222-222222222222';
const { modalProps, refetch } = vi.hoisted(() => ({ modalProps: [] as any[], refetch: vi.fn() }));

const request = (overrides: Partial<JournalItem>): JournalItem => ({
  id: TASK_ID,
  taskId: TASK_ID,
  kind: 'patient-request',
  label: 'Reply to patient message',
  when: 'received',
  since: new Date().toISOString(),
  patientId: 'pat-ava',
  appointmentId: 'appt-1',
  encounterId: 'enc-1',
  code: PATIENT_REQUEST_TASK.code.prescriptionRefill,
  unread: true,
  title: 'Prescription Refill for Ava Doe 11/06/2026',
  ...overrides,
});

const journal = (item: JournalItem): GetProviderJournalResponse => ({
  kind: 'provider',
  comingUp: [],
  today: [],
  todayDone: [],
  seenTodayCount: 0,
  recent: [],
  past: [],
  notTied: [
    {
      patient: { patientId: 'pat-ava', name: 'Ava Doe', firstName: 'Ava', lastName: 'Doe', phones: [] },
      visits: [],
      items: [item],
    },
  ],
});

let data: GetProviderJournalResponse | undefined = journal(request({}));
let isError = false;

vi.mock('../../src/features/journal/hooks/useProviderJournal', () => ({
  useProviderJournal: () => ({ data, isLoading: false, isError, refetch }),
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
vi.mock('../../src/features/support-chat/components/SupportChatModal', () => ({
  SupportChatModal: (props: any) => {
    modalProps.push(props);
    return <button onClick={() => props.onClose()}>close support chat</button>;
  },
}));

describe('JournalPage Support Chat request', () => {
  it('opens the Tasks page’s Support Chat dialog while unread, and reloads the journal when it closes', async () => {
    data = journal(request({}));
    render(
      <MemoryRouter>
        <JournalPage />
      </MemoryRouter>
    );
    refetch.mockClear();
    await userEvent.click(screen.getByText('Reply to patient message'));
    expect(modalProps.at(-1).task).toEqual(
      expect.objectContaining({
        id: TASK_ID,
        title: 'Prescription Refill for Ava Doe 11/06/2026',
        chat: { hasUnread: true },
      })
    );
    expect(modalProps.at(-1).isCompleting).toBeFalsy();

    await userEvent.click(screen.getByText('close support chat'));
    expect(screen.queryByText('close support chat')).toBeNull();
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
  });

  it('keeps the page link once the request is read', () => {
    data = journal(
      request({ unread: undefined, title: undefined, label: 'Prescription Refill for Ava Doe 11/06/2026' })
    );
    render(
      <MemoryRouter>
        <JournalPage />
      </MemoryRouter>
    );
    const link = screen.getByText('Prescription Refill for Ava Doe 11/06/2026').closest('a');
    expect(link?.getAttribute('target')).toBe('_blank');
  });
});

describe('JournalPage load error', () => {
  it('keeps a loaded journal on screen when a reload fails, and shows the error only with no data', () => {
    data = journal(request({}));
    isError = true;
    const { unmount } = render(
      <MemoryRouter>
        <JournalPage />
      </MemoryRouter>
    );
    expect(screen.getByText('Reply to patient message')).toBeTruthy();
    expect(screen.queryByText('Could not load the journal')).toBeNull();
    unmount();

    data = undefined;
    render(
      <MemoryRouter>
        <JournalPage />
      </MemoryRouter>
    );
    expect(screen.getByText('Could not load the journal')).toBeTruthy();
    isError = false;
  });
});
