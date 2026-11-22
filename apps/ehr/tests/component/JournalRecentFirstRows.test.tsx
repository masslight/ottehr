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

const recent = Array.from({ length: 53 }, (_, i) =>
  row(`p${i + 1}`, `Patient Number${i + 1}`, [item(`t${i + 1}`, 'fax')], false)
);
const journal: GetProviderJournalResponse = {
  kind: 'provider',
  comingUp: [],
  today: [],
  todayDone: [],
  seenTodayCount: 0,
  recent,
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

describe('a long Recent list', () => {
  it('draws the first 50 rows, then "+ N more", and search still finds every row', async () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter>
          <JournalPage />
        </MemoryRouter>
      </ThemeProvider>
    );
    const rows = (): number => screen.queryAllByText(/^Patient Number\d+$/).length;
    expect(rows()).toBe(50);
    expect(screen.getByText('53 actions to take: 53 faxes')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: '+ 3 more patients with to-dos' }));
    expect(rows()).toBe(53);
    await userEvent.click(screen.getByRole('button', { name: 'Show fewer' }));
    expect(rows()).toBe(50);

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search patients' }), 'number53');
    expect(screen.getByText('Patient Number53')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /more patients with to-dos/ })).toBeNull();
  });
});
