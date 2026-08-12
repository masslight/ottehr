import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const PATIENT_ID = '11111111-1111-1111-1111-111111111111';
const VISITS = [
  { appointmentId: 'appointment-1', dateTime: '2026-04-11T09:30:00.000-04:00', timezone: 'America/New_York' },
  { appointmentId: 'appointment-2', dateTime: '2026-07-02T11:30:00.000-04:00', timezone: 'America/New_York' },
];

const mockSendFax = vi.fn<(...args: any[]) => Promise<void>>();
const mockDownloadMedicalRecord = vi.fn<() => Promise<void>>();

vi.mock('src/hooks/useSendFax', () => ({ useSendFax: () => mockSendFax }));
vi.mock('src/hooks/useDownloadMedicalRecord', () => ({
  useDownloadMedicalRecord: () => ({ downloadMedicalRecord: mockDownloadMedicalRecord, isDownloading: false }),
}));
vi.mock('src/hooks/useGetPatientVisitHistory', () => ({
  useGetPatientVisitHistory: () => ({ data: { visits: VISITS, metadata: { totalCount: 2, sortDirection: 'desc' } } }),
}));
vi.mock('../../src/hooks/useGetPatient', () => ({
  useGetPatient: () => ({
    loading: false,
    patient: { resourceType: 'Patient', id: PATIENT_ID, name: [{ given: ['Oliver'], family: 'Black' }] },
    duplicatePatients: [],
  }),
  useGetActiveMergeTask: () => ({ data: { task: null }, refetch: vi.fn() }),
}));
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehr: undefined }) }));
vi.mock('src/hooks/useEvolveUser', () => ({ default: () => ({ hasRole: () => true }) }));
vi.mock('../../src/layout/PageContainer', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
// The tabs below the header pull in the whole visit/lab stack, which this test doesn't exercise.
vi.mock('../../src/components/PatientEncountersGrid', () => ({ PatientEncountersGrid: () => <div /> }));
vi.mock('../../src/components/PatientLabsTab', () => ({ PatientLabsTab: () => <div /> }));
vi.mock('src/components/PatientInHouseLabsTab', () => ({ PatientInHouseLabsTab: () => <div /> }));
vi.mock('src/components/PatientRadiologyTab', () => ({ PatientRadiologyTab: () => <div /> }));

import PatientPage from '../../src/pages/PatientPage';

const renderPage = (): void => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/patient/${PATIENT_ID}`]}>
        <Routes>
          <Route path="/patient/:id" element={<PatientPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const sendFaxTo = async (user: ReturnType<typeof userEvent.setup>, faxNumber: string): Promise<void> => {
  await user.type(await screen.findByLabelText(/Fax number/i), faxNumber);
  await user.click(screen.getByRole('button', { name: 'Send Fax' }));
};

describe('PatientPage fax actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendFax.mockResolvedValue(undefined);
  });

  it('faxes the selected visits from Fax Patient Docs', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Fax Patient Docs/i }));
    // Visits are listed in the office's own timezone, not the reader's.
    expect(screen.getByText('04/11/2026 09:30 AM ET')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /07\/02\/2026/ }));
    await sendFaxTo(user, '2125551234');

    await waitFor(() =>
      expect(mockSendFax).toHaveBeenCalledWith({
        target: { type: 'visit-documents', patientId: PATIENT_ID, appointmentIds: ['appointment-1'] },
        recipients: [{ name: '', organization: '', faxNumber: '2125551234', phoneNumber: '' }],
      })
    );
  });

  it('offers Download Archive and Send as Fax for the medical record', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Medical Record/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Download Archive' }));

    expect(mockDownloadMedicalRecord).toHaveBeenCalledTimes(1);
    expect(mockSendFax).not.toHaveBeenCalled();
  });

  it('faxes the whole record from the Medical Record menu', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Medical Record/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Send as Fax' }));

    // The whole record is one fax, so no visit picker is shown.
    expect(screen.queryByText('Select Visits')).not.toBeInTheDocument();
    await sendFaxTo(user, '2125551234');

    await waitFor(() =>
      expect(mockSendFax).toHaveBeenCalledWith({
        target: { type: 'medical-record', patientId: PATIENT_ID },
        recipients: [{ name: '', organization: '', faxNumber: '2125551234', phoneNumber: '' }],
      })
    );
    expect(mockDownloadMedicalRecord).not.toHaveBeenCalled();
  });
});
