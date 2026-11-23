import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { GetProviderJournalResponse, JournalVisit } from 'utils/lib/types/api/provider-journal.types';
import { describe, expect, it, vi } from 'vitest';
import { JournalPage } from '../../src/features/journal/pages/JournalPage';

const BEN = '11111111-1111-4111-8111-111111111111';
const ANA = '22222222-2222-4222-8222-222222222222';

const visit = (id: string, attenderId: string): JournalVisit => ({
  appointmentId: `appt-${id}`,
  encounterId: `enc-${id}`,
  start: new Date(Date.now() - 3 * 864e5).toISOString(),
  isTelemed: false,
  isFollowUp: false,
  status: 'completed',
  hasProgressNote: true,
  attenderId,
});

const row = (id: string, name: string, attenderId: string): GetProviderJournalResponse['recent'][number] => {
  const v = visit(id, attenderId);
  return {
    patient: { patientId: `pat-${id}`, name, phones: [] },
    visits: [v],
    items: [
      {
        id: `t-${id}`,
        kind: 'task',
        label: 'Call about results',
        when: 'created',
        since: new Date(Date.now() - 864e5).toISOString(),
        encounterId: v.encounterId,
      },
    ],
  };
};

const journal: GetProviderJournalResponse = {
  kind: 'provider',
  comingUp: [],
  today: [],
  todayDone: [],
  seenTodayCount: 0,
  // Ben is the "Pr:" of the first visit and Ana only its "In:"; Ana is the "Pr:" of the second.
  recent: [row('ben', 'Xavier Benvisit', BEN), row('ana', 'Yara Anavisit', ANA)],
  past: [],
  notTied: [],
};

vi.mock('../../src/features/journal/hooks/useProviderJournal', () => ({
  useProviderJournal: () => ({ data: journal, isLoading: false, isError: false, refetch: vi.fn() }),
}));
// Ben, a provider, has Ana's journal open.
vi.mock('../../src/features/journal/hooks/useJournalOwners', () => ({
  useJournalOwners: () => ({
    owners: [{ practitionerId: ANA, name: 'Ana Rivera' }],
    myPractitionerId: BEN,
    iAmProvider: true,
    isLoading: false,
  }),
}));
vi.mock('src/api/api', () => ({}));
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {}, oystehr: {} }) }));
vi.mock('../../src/hooks/useLocationSupportPhones', () => ({
  useSupportPhonesMap: () => ({ phonesByLocationName: {} }),
}));
vi.mock('../../src/layout/PageContainer', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe('JournalPage Make me provider', () => {
  it("hides the side column's ▾ on a visit the signed-in provider already holds, as the command palette does", async () => {
    render(
      <MemoryRouter>
        <JournalPage />
      </MemoryRouter>
    );
    await userEvent.click(screen.getAllByText('Xavier Benvisit')[0]);
    expect(screen.queryAllByRole('button', { name: 'Progress Note options' })).toHaveLength(0);
    await userEvent.click(screen.getAllByText('Yara Anavisit')[0]);
    expect(screen.queryAllByRole('button', { name: 'Progress Note options' })).toHaveLength(1);
  });
});
