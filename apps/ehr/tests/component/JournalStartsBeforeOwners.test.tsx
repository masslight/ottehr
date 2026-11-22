import { render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { GetProviderJournalResponse } from 'utils/lib/types/api/provider-journal.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JournalPage } from '../../src/features/journal/pages/JournalPage';

const ME = '11111111-1111-4111-8111-111111111111';
const COLLEAGUE = '22222222-2222-4222-8222-222222222222';

const journal: GetProviderJournalResponse = {
  kind: 'provider',
  comingUp: [],
  today: [],
  todayDone: [],
  seenTodayCount: 0,
  recent: [],
  past: [],
  notTied: [],
};

const state = vi.hoisted(() => ({
  owners: { owners: [] as { practitionerId: string; name: string }[], isLoading: true },
  // Journals that load; any other id fails, as the server does for a user without a journal.
  journals: new Set<string>(),
  requested: [] as (string | undefined)[],
}));

vi.mock('../../src/features/journal/hooks/useProviderJournal', () => ({
  useProviderJournal: (id: string | undefined) => {
    if (state.requested.at(-1) !== id) state.requested.push(id);
    return id && state.journals.has(id)
      ? { data: journal, isLoading: false, refetch: vi.fn() }
      : { data: undefined, isLoading: false, isError: true, refetch: vi.fn() };
  },
}));
vi.mock('../../src/features/journal/hooks/useJournalOwners', () => ({
  useJournalOwners: () => ({ ...state.owners, myPractitionerId: ME, iAmProvider: false }),
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

const page = (): JSX.Element => (
  <MemoryRouter>
    <JournalPage />
  </MemoryRouter>
);

describe('the journal starts loading before the staff list arrives', () => {
  beforeEach(() => {
    state.owners = { owners: [], isLoading: true };
    state.journals = new Set();
    state.requested = [];
  });

  it("asks for the user's own journal while the staff list loads, and keeps it once the list arrives", () => {
    state.journals.add(ME);
    const { rerender } = render(page());
    expect(state.requested).toEqual([ME]);
    expect(screen.getByRole('progressbar', { name: 'Loading the journal' })).toBeInTheDocument();

    state.owners = { owners: [{ practitionerId: ME, name: 'Ana Rivera' }], isLoading: false };
    rerender(page());
    expect(state.requested).toEqual([ME]);
    expect(screen.getByRole('heading', { name: /Ana Rivera|My journal/i })).toBeInTheDocument();
  });

  it('shows a user without a journal the first colleague’s, never an error', () => {
    state.journals.add(COLLEAGUE);
    const { rerender } = render(page());
    expect(screen.queryByText('Could not load the journal')).toBeNull();
    expect(screen.getByRole('progressbar', { name: 'Loading the journal' })).toBeInTheDocument();

    state.owners = { owners: [{ practitionerId: COLLEAGUE, name: 'Joe Lin' }], isLoading: false };
    rerender(page());
    expect(state.requested).toEqual([ME, COLLEAGUE]);
    expect(screen.queryByText('Could not load the journal')).toBeNull();
    expect(screen.getByRole('heading', { name: /Joe Lin/ })).toBeInTheDocument();
  });
});
