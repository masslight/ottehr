import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const PATIENT_ID = '11111111-1111-1111-1111-111111111111';

vi.mock('../../src/constants/feature-flags', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/constants/feature-flags')>();
  return { ...original, FEATURE_FLAGS: { ...original.FEATURE_FLAGS, RADIOLOGY_ENABLED: false } };
});
vi.mock('src/features/send-documents/hooks/useSendDocuments', () => ({
  useSendDocuments: () => ({ isOpen: false, open: vi.fn(), close: vi.fn(), isSending: false }),
}));
vi.mock('src/features/send-documents/ui/SendDocumentsDialog', () => ({ SendDocumentsDialog: () => <div /> }));
vi.mock('src/hooks/useDownloadMedicalRecord', () => ({
  useDownloadMedicalRecord: () => ({ downloadMedicalRecord: vi.fn(), isDownloading: false }),
}));
vi.mock('src/hooks/useGetPatientVisitHistory', () => ({
  useGetPatientVisitHistory: () => ({ data: { visits: [], metadata: { totalCount: 0, sortDirection: 'desc' } } }),
}));
vi.mock('../../src/hooks/useGetPatient', () => ({
  useGetPatient: () => ({
    loading: false,
    patient: { resourceType: 'Patient', id: PATIENT_ID, name: [{ given: ['Oliver'], family: 'Black' }] },
    duplicatePatients: [],
  }),
  useGetActiveMergeTask: () => ({ data: { task: null }, refetch: vi.fn() }),
}));
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehr: undefined, oystehrZambda: {} }) }));
vi.mock('src/hooks/useEvolveUser', () => ({ default: () => ({ hasRole: () => true }) }));
vi.mock('../../src/layout/PageContainer', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('../../src/components/PatientEncountersGrid', () => ({ PatientEncountersGrid: () => <div>visits panel</div> }));
vi.mock('../../src/components/PatientLabsTab', () => ({ PatientLabsTab: () => <div>labs panel</div> }));
vi.mock('src/components/PatientInHouseLabsTab', () => ({ PatientInHouseLabsTab: () => <div /> }));
vi.mock('src/components/PatientRadiologyTab', () => ({ PatientRadiologyTab: () => <div>radiology panel</div> }));
vi.mock('src/features/referrals/PatientReferralsTab', () => ({
  PatientReferralsTab: () => <div>referrals panel</div>,
}));

import PatientPage from '../../src/pages/PatientPage';

const LocationProbe = (): JSX.Element => {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <div data-testid="location">{`${location.pathname}${location.search}`}</div>
      <button onClick={() => navigate(`/patient/${PATIENT_ID}?tab=referrals`)}>open referrals notification</button>
    </>
  );
};

const renderPage = (entry: string | { pathname: string; state: unknown }): void => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route
            path="/patient/:id"
            element={
              <>
                <PatientPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const selectedTab = (): string | null =>
  screen.getAllByRole('tab').find((tab) => tab.getAttribute('aria-selected') === 'true')?.textContent ?? null;

describe('PatientPage tabs', () => {
  it('opens the tab named by ?tab=', () => {
    renderPage(`/patient/${PATIENT_ID}?tab=referrals`);
    expect(selectedTab()).toBe('Referrals');
    expect(screen.getByText('referrals panel')).toBeInTheDocument();
  });

  it('switches tabs when ?tab= changes while the page is mounted, as the notification bell navigates', async () => {
    renderPage(`/patient/${PATIENT_ID}`);
    expect(selectedTab()).toMatch(/^Visits/);

    await userEvent.setup().click(screen.getByRole('button', { name: 'open referrals notification' }));

    expect(selectedTab()).toBe('Referrals');
    expect(screen.getByText('referrals panel')).toBeInTheDocument();
  });

  it('writes the clicked tab into the URL so a reload returns to it', async () => {
    renderPage(`/patient/${PATIENT_ID}?tab=referrals`);

    await userEvent.setup().click(screen.getByRole('tab', { name: /^Visits/ }));

    expect(selectedTab()).toMatch(/^Visits/);
    expect(screen.getByTestId('location')).toHaveTextContent(`/patient/${PATIENT_ID}?tab=encounters`);
  });

  it('falls back to Visits for an unknown tab or one whose feature flag is off, instead of a blank panel', () => {
    renderPage(`/patient/${PATIENT_ID}?tab=foo`);
    expect(selectedTab()).toMatch(/^Visits/);
    expect(screen.getByText('visits panel')).toBeInTheDocument();
  });

  it('does not open a tab hidden by its feature flag', () => {
    renderPage(`/patient/${PATIENT_ID}?tab=radiology`);
    expect(selectedTab()).toMatch(/^Visits/);
    expect(screen.queryByText('radiology panel')).not.toBeInTheDocument();
  });

  it('still honours the defaultTab router state existing callers pass', () => {
    renderPage({ pathname: `/patient/${PATIENT_ID}`, state: { defaultTab: 'referrals' } });
    expect(selectedTab()).toBe('Referrals');
  });
});
