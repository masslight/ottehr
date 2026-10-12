import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const PATIENT_ID = '11111111-1111-1111-1111-111111111111';
const VISITS = [
  { appointmentId: 'appointment-2', dateTime: '2026-07-02T11:30:00.000-04:00', timezone: 'America/New_York' },
  { appointmentId: 'appointment-1', dateTime: '2026-04-11T09:30:00.000-04:00', timezone: 'America/New_York' },
];

const mockUseSendFax = vi.fn();
const mockOpen = vi.fn();
const mockDownloadMedicalRecord = vi.fn<(dateRange: unknown) => Promise<void>>();
const mockGetFaxPacketPreview = vi.fn();

// The fax slice owns sending; this page's job is to hand it the right source and visit list.
vi.mock('src/features/fax/hooks/useSendFax', () => ({
  useSendFax: (source: unknown) => {
    mockUseSendFax(source);
    return { isOpen: false, open: mockOpen, close: vi.fn(), isSending: false, failures: [] };
  },
}));
vi.mock('src/features/fax/ui/SendFaxDialog', () => ({
  SendFaxDialog: ({ title, visits }: { title?: string; visits?: { label: string }[] }) => (
    <div data-testid="fax-dialog" data-title={title}>
      {visits?.map((visit) => <span key={visit.label}>{visit.label}</span>)}
    </div>
  ),
}));
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
vi.mock('src/features/visits/shared/hooks/useOystehrAPIClient', () => ({
  useOystehrAPIClient: () => ({ getFaxPacketPreview: mockGetFaxPacketPreview }),
}));
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

/** The source the page last handed the fax slice. */
const lastSource = (): any => mockUseSendFax.mock.calls.at(-1)?.[0];

describe('PatientPage fax actions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('faxes the patient visits from Fax Patient Docs', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Fax Patient Docs/i }));

    expect(lastSource()).toEqual({
      type: 'visits',
      patientId: PATIENT_ID,
      appointmentIds: ['appointment-2', 'appointment-1'],
    });
    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('fax-dialog')).toHaveAttribute('data-title', 'Fax Patient Docs');
    // Visits are offered in the office's own timezone, not the reader's.
    expect(screen.getByText('04/11/2026 09:30 AM ET')).toBeInTheDocument();
  });

  it('downloads the medical record for the confirmed date range', async () => {
    const user = userEvent.setup();
    mockDownloadMedicalRecord.mockResolvedValue();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Medical Record/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Download Archive' }));
    await user.click(screen.getByTestId(dataTestIds.medicalRecordDateRangeDialog.confirmButton));

    expect(mockDownloadMedicalRecord).toHaveBeenCalledWith({
      from: expect.stringMatching(/^2026-04-11T00:00:00/),
      to: expect.any(String),
    });
    expect(mockOpen).not.toHaveBeenCalled();
  });

  it('keeps the date range dialog open with the error when the download fails', async () => {
    const user = userEvent.setup();
    mockDownloadMedicalRecord.mockRejectedValue(new Error('Export failed'));
    renderPage();

    await user.click(screen.getByRole('button', { name: /Medical Record/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Download Archive' }));
    await user.click(screen.getByTestId(dataTestIds.medicalRecordDateRangeDialog.confirmButton));

    expect(await screen.findByTestId(dataTestIds.medicalRecordDateRangeDialog.message)).toHaveTextContent(
      'Export failed'
    );
    expect(screen.getByTestId(dataTestIds.medicalRecordDateRangeDialog.root)).toBeInTheDocument();
  });

  it('faxes the medical record for the confirmed date range', async () => {
    const user = userEvent.setup();
    mockGetFaxPacketPreview.mockResolvedValue({ documentCount: 3 });
    renderPage();

    await user.click(screen.getByRole('button', { name: /Medical Record/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Send as Fax' }));
    await user.click(screen.getByTestId(dataTestIds.medicalRecordDateRangeDialog.confirmButton));

    expect(lastSource()).toEqual({
      type: 'medical-record',
      patientId: PATIENT_ID,
      dateRange: { from: expect.stringMatching(/^2026-04-11T00:00:00/), to: expect.any(String) },
    });
    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(mockDownloadMedicalRecord).not.toHaveBeenCalled();
    // The whole record is one packet, so no visit picker is offered.
    expect(screen.getByTestId('fax-dialog')).not.toHaveTextContent('04/11/2026');
  });
});
