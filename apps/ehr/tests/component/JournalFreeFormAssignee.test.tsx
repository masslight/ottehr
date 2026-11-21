import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { GetProviderJournalResponse, JournalItem } from 'utils/lib/types/api/provider-journal.types';
import { describe, expect, it, vi } from 'vitest';
import { JournalPage } from '../../src/features/journal/pages/JournalPage';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

const callTask = (id: string, label: string, assigneeId?: string): JournalItem => ({
  id,
  taskId: id,
  kind: 'task',
  label,
  when: 'assigned',
  since: new Date().toISOString(),
  patientId: 'pat-ida',
  isCallTask: true,
  assigneeId,
});

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
      patient: { patientId: 'pat-ida', name: 'Ida Notied', phones: [] },
      visits: [],
      items: [
        callTask('t-mine', 'Call about culture results', ME),
        callTask('t-other', 'Call about x-ray', OTHER),
        callTask('t-none', 'Call about refill'),
      ],
    },
  ],
};

vi.mock('../../src/features/journal/hooks/useProviderJournal', () => ({
  useProviderJournal: () => ({ data: journal, isLoading: false, isError: false, refetch: vi.fn() }),
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
vi.mock('../../src/hooks/useLocationSupportPhones', () => ({
  useSupportPhonesMap: () => ({ phonesByLocationName: {} }),
}));
vi.mock('src/features/visits/shared/hooks/useOystehrAPIClient', () => ({ useOystehrAPIClient: () => undefined }));
vi.mock('src/hooks/useEvolveUser', () => ({
  default: () => ({ userName: 'Ana Rivera', profile: `Practitioner/${ME}` }),
}));
vi.mock('../../src/layout/PageContainer', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('../../src/features/chat/ChatModal', () => ({ default: () => null }));

describe('Free Form "Mark … done"', () => {
  it('offers only the tasks assigned to the signed-in user, like the Tasks page’s Complete', async () => {
    render(
      <MemoryRouter>
        <JournalPage />
      </MemoryRouter>
    );
    await userEvent.click(screen.getAllByRole('button', { name: 'Add a Free Form' })[0]);
    expect(screen.getByLabelText("Mark 'Call about culture results' done")).toBeTruthy();
    expect(screen.queryByLabelText("Mark 'Call about x-ray' done")).toBeNull();
    expect(screen.queryByLabelText("Mark 'Call about refill' done")).toBeNull();
  });
});
