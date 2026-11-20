import { createTheme, ThemeProvider } from '@mui/material';
import { render as rtlRender, RenderResult, screen, within } from '@testing-library/react';
import { DateTime } from 'luxon';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { GetProviderJournalResponse, JournalItem } from 'utils/lib/types/api/provider-journal.types';
import { describe, expect, it, vi } from 'vitest';
import { JournalSideColumn } from '../../src/features/journal/components/JournalSideColumn';
import { rowRef } from '../../src/features/journal/helpers/journalHelpers';
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
      patient: { patientId: 'pat-ida', name: 'Ida Notied', birthDate: '2015-01-01', phones: [] },
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
vi.mock('src/features/visits/shared/hooks/useOystehrAPIClient', () => ({ useOystehrAPIClient: () => undefined }));
vi.mock('src/hooks/useEvolveUser', () => ({
  default: () => ({ userName: 'Ana Rivera', profile: `Practitioner/${ME}` }),
}));
vi.mock('../../src/layout/PageContainer', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('../../src/features/chat/ChatModal', () => ({ default: () => null }));

// The tracking board's PatientDateOfBirth reads the app theme.
const render = (ui: ReactNode): RenderResult => rtlRender(<ThemeProvider theme={createTheme()}>{ui}</ThemeProvider>);

const DOB = /^DOB: 01\/01\/2015 \(.+\)$/;

describe('date of birth next to the name, as on the tracking board', () => {
  it('shows it on the row and in the Free Form dialog', async () => {
    render(
      <MemoryRouter>
        <JournalPage />
      </MemoryRouter>
    );
    expect(screen.getAllByText(DOB).length).toBeGreaterThan(0);
    await userEvent.click(screen.getAllByRole('button', { name: 'Add a Free Form' })[0]);
    expect(within(screen.getByRole('dialog')).getByText(DOB)).toBeTruthy();
  });

  it('shows it in the side column', () => {
    render(
      <JournalSideColumn
        selected={rowRef('np', journal.notTied[0])}
        kind="provider"
        now={DateTime.now()}
        actions={[]}
        onOpenChat={() => {}}
        onAddendum={() => {}}
      />
    );
    expect(screen.getByText(DOB)).toBeTruthy();
  });
});
