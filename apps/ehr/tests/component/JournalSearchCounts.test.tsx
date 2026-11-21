import { createTheme, ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  GetProviderJournalResponse,
  JournalItem,
  JournalItemKind,
  JournalRow,
  JournalVisit,
} from 'utils/lib/types/api/provider-journal.types';
import { describe, expect, it, vi } from 'vitest';
import { JournalPage } from '../../src/features/journal/pages/JournalPage';

const ME = '11111111-1111-4111-8111-111111111111';

const visit = (id: string): JournalVisit => ({
  appointmentId: `appt-${id}`,
  encounterId: `enc-${id}`,
  start: new Date().toISOString(),
  isTelemed: false,
  isFollowUp: false,
  status: 'completed',
  hasProgressNote: true,
});
const item = (id: string, kind: JournalItemKind): JournalItem => ({
  id,
  kind,
  label: `To-do ${id}`,
  when: 'created',
  since: new Date().toISOString(),
});
const row = (id: string, name: string, items: JournalItem[], withVisit = true): JournalRow => ({
  patient: { patientId: `pat-${id}`, name, phones: [] },
  visits: withVisit ? [visit(id)] : [],
  visit: withVisit ? visit(id) : undefined,
  items,
});

const journal: GetProviderJournalResponse = {
  kind: 'provider',
  comingUp: [],
  today: [
    row('ann', 'Ann Alpha', [item('a1', 'unsigned-note')]),
    row('bob', 'Bob Beta', [item('b1', 'fax'), item('b2', 'fax')]),
  ],
  todayDone: [row('cara', 'Cara Gamma', [])],
  seenTodayCount: 3,
  recent: [
    row('dan', 'Dan Alpha', [item('d1', 'fax')], false),
    row('eve', 'Eve Delta', [item('e1', 'unsigned-note'), item('e2', 'fax')], false),
  ],
  past: [],
  notTied: [],
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

describe('summary bars while searching', () => {
  it('count only the rows shown, like Coming Up, and come back when the search is cleared', async () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter>
          <JournalPage />
        </MemoryRouter>
      </ThemeProvider>
    );
    const full = (): void => {
      expect(screen.getByText('3 patients seen · 3 actions to take: 1 unsigned note, 2 faxes')).toBeTruthy();
      expect(screen.getByText('3 actions to take: 1 unsigned note, 2 faxes')).toBeTruthy();
    };
    full();

    const search = screen.getByRole('searchbox', { name: 'Search patients' });
    await userEvent.type(search, 'alpha');
    expect(screen.getByText('1 patient seen · 1 action to take: 1 unsigned note')).toBeTruthy();
    expect(screen.getByText('1 action to take: 1 fax')).toBeTruthy();

    await userEvent.clear(search);
    full();
  });
});
