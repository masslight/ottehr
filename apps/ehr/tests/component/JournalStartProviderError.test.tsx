import { createTheme, ThemeProvider } from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { GetProviderJournalResponse, JournalVisit } from 'utils/lib/types/api/provider-journal.types';
import { describe, expect, it, vi } from 'vitest';
import { JournalPage } from '../../src/features/journal/pages/JournalPage';

const ME = '11111111-1111-4111-8111-111111111111';

const ready: JournalVisit = {
  appointmentId: 'appt-ann',
  encounterId: 'enc-ann',
  start: new Date().toISOString(),
  isTelemed: false,
  isFollowUp: false,
  status: 'ready for provider',
  hasProgressNote: true,
};
const journal: GetProviderJournalResponse = {
  kind: 'provider',
  comingUp: [
    { patient: { patientId: 'pat-ann', name: 'Ann Alpha', phones: [] }, visit: ready, visits: [ready], items: [] },
  ],
  today: [],
  todayDone: [],
  seenTodayCount: 0,
  recent: [],
  past: [],
  notTied: [],
};

// The real SDK, api.ts and status helper run; only the network answer is faked.
vi.hoisted(() => vi.stubEnv('VITE_APP_IS_LOCAL', 'false'));
const net = vi.hoisted(() => ({ fetch: async (_req: Request): Promise<Response> => new Response() }));
const snackbar = vi.hoisted(() => vi.fn());
const oystehrZambda = new Oystehr({
  accessToken: 'test-token',
  services: { zambdaApiUrl: 'https://zambda.test' },
  fetch: (req) => net.fetch(req),
});

vi.mock('notistack', async (importOriginal) => ({
  ...(await importOriginal<typeof import('notistack')>()),
  enqueueSnackbar: snackbar,
}));
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
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda, oystehr: {} }) }));
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

const startProvider = async (): Promise<string> => {
  snackbar.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  render(
    <ThemeProvider theme={createTheme()}>
      <MemoryRouter>
        <JournalPage />
      </MemoryRouter>
    </ThemeProvider>
  );
  await userEvent.click(screen.getByRole('button', { name: 'Start Provider (opens the chart in a new tab)' }));
  await waitFor(() => expect(snackbar).toHaveBeenCalled());
  return snackbar.mock.calls[0][0];
};

// The tracking board's Start Provider error.
const READABLE = 'An error occurred. Please try again.';

describe('Start Provider fails', () => {
  it('offline (fetch rejects with a TypeError): a readable message', async () => {
    net.fetch = async () => {
      throw new TypeError('Failed to fetch');
    };
    expect(await startProvider()).toBe(READABLE);
  });

  it('the zambda returns an APIError: a readable message, no server internals', async () => {
    net.fetch = async () =>
      new Response(
        JSON.stringify({ output: { message: 'Internal Service Error: FHIR 412 at Encounter/enc-ann', code: 4000 } }),
        {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }
      );
    expect(await startProvider()).toBe(READABLE);
  });
});
