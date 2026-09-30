import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const PATIENT_ID = '11111111-1111-1111-1111-111111111111';
const EXPECTED_LEGACY_DATA_SEARCH = '?lastName=Black&firstName=Oliver&dob=03-07-2014';

const flags = vi.hoisted(() => ({ legacyDataEnabled: true }));

vi.mock('../../src/constants/feature-flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/constants/feature-flags')>();
  return {
    FEATURE_FLAGS: {
      ...actual.FEATURE_FLAGS,
      get LEGACY_DATA_ENABLED() {
        return flags.legacyDataEnabled;
      },
    },
  };
});
vi.mock('src/features/fax', () => ({
  useSendFax: () => ({ isOpen: false, open: vi.fn(), close: vi.fn(), isSending: false, failures: [] }),
  SendFaxDialog: () => <div />,
}));
vi.mock('src/hooks/useDownloadMedicalRecord', () => ({
  useDownloadMedicalRecord: () => ({ downloadMedicalRecord: vi.fn(), isDownloading: false }),
}));
vi.mock('src/hooks/useGetPatientVisitHistory', () => ({
  useGetPatientVisitHistory: () => ({ data: { visits: [], metadata: { totalCount: 0, sortDirection: 'desc' } } }),
}));
vi.mock('../../src/hooks/useGetPatient', () => ({
  useGetPatient: () => ({
    loading: false,
    patient: {
      resourceType: 'Patient',
      id: PATIENT_ID,
      name: [{ given: ['Oliver'], family: 'Black' }],
      birthDate: '2014-03-07',
    },
    duplicatePatients: [],
  }),
  useGetActiveMergeTask: () => ({ data: { task: null }, refetch: vi.fn() }),
}));
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehr: undefined }) }));
vi.mock('src/hooks/useEvolveUser', () => ({ default: () => ({ hasRole: () => true }) }));
vi.mock('../../src/layout/PageContainer', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('../../src/components/PatientEncountersGrid', () => ({ PatientEncountersGrid: () => <div /> }));
vi.mock('../../src/components/PatientLabsTab', () => ({ PatientLabsTab: () => <div /> }));
vi.mock('src/components/PatientInHouseLabsTab', () => ({ PatientInHouseLabsTab: () => <div /> }));
vi.mock('src/components/PatientRadiologyTab', () => ({ PatientRadiologyTab: () => <div /> }));

import PatientPage from '../../src/pages/PatientPage';

const LegacyDataRouteProbe = (): JSX.Element => {
  const { search } = useLocation();
  return <div data-testid="legacy-data-route">{search}</div>;
};

const renderPage = (): void => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/patient/${PATIENT_ID}`]}>
        <Routes>
          <Route path="/patient/:id" element={<PatientPage />} />
          <Route path="/legacy-data" element={<LegacyDataRouteProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('PatientPage Legacy Data button', () => {
  beforeEach(() => {
    flags.legacyDataEnabled = true;
  });

  it('opens the legacy data search prefilled with the patient name and date of birth', async () => {
    const user = userEvent.setup();
    renderPage();

    const legacyDataLink = screen.getByRole('link', { name: /Legacy Data/i });
    expect(legacyDataLink).toHaveAttribute('href', `/legacy-data${EXPECTED_LEGACY_DATA_SEARCH}`);

    await user.click(legacyDataLink);

    expect(screen.getByTestId('legacy-data-route')).toHaveTextContent(EXPECTED_LEGACY_DATA_SEARCH);
  });

  it('is hidden when the legacy data feature is disabled', () => {
    flags.legacyDataEnabled = false;
    renderPage();

    expect(screen.queryByRole('link', { name: /Legacy Data/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Account Settings/i })).toBeInTheDocument();
  });
});
