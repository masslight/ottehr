import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTime } from 'luxon';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { NO_MEDICAL_RECORDS_IN_RANGE_MESSAGE } from 'utils/lib/types/data/get-patient-medical-record.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const PATIENT_ID = '11111111-1111-1111-1111-111111111111';
const VISITS = [
  { appointmentId: 'appointment-2', dateTime: '2026-07-02T11:30:00.000-04:00', timezone: 'America/New_York' },
  { appointmentId: 'appointment-1', dateTime: '2026-04-11T09:30:00.000-04:00', timezone: 'America/New_York' },
];
const PREDEFINED_RANGE = { from: DateTime.local(2026, 4, 11).toISO(), to: DateTime.now().endOf('day').toISO() };

let mockVisits: { appointmentId: string; dateTime: string; timezone: string }[] = VISITS;
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
  useGetPatientVisitHistory: () => ({
    data: { visits: mockVisits, metadata: { totalCount: mockVisits.length, sortDirection: 'desc' } },
  }),
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
const rangeIds = dataTestIds.medicalRecordDateRangeDialog;

describe('PatientPage fax actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVisits = VISITS;
    mockDownloadMedicalRecord.mockResolvedValue();
    mockGetFaxPacketPreview.mockResolvedValue({ documents: [], hasSavedPcp: false, documentCount: 3 });
  });

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

  it('asks for a date range before downloading the archive, predefined from the first visit to today', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Medical Record/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Download Archive' }));

    expect(mockDownloadMedicalRecord).not.toHaveBeenCalled();
    expect(screen.getByTestId(rangeIds.fromInput)).toHaveValue('04/11/2026');
    expect(screen.getByTestId(rangeIds.toInput)).toHaveValue(DateTime.now().toFormat('MM/dd/yyyy'));
    expect(screen.getByTestId(rangeIds.confirmButton)).toHaveTextContent('Download Archive');

    await user.click(screen.getByTestId(rangeIds.confirmButton));

    expect(mockDownloadMedicalRecord).toHaveBeenCalledWith(PREDEFINED_RANGE);
    expect(mockOpen).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId(rangeIds.root)).not.toBeInTheDocument());
  });

  it("predefines From as the first visit's day in its office timezone", async () => {
    const user = userEvent.setup();
    mockVisits = [
      { appointmentId: 'appointment-late', dateTime: '2026-04-10T23:30:00.000-04:00', timezone: 'America/New_York' },
    ];
    renderPage();

    await user.click(screen.getByRole('button', { name: /Medical Record/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Download Archive' }));

    expect(screen.getByTestId(rangeIds.fromInput)).toHaveValue('04/10/2026');
  });

  it('leaves From empty for a patient with no visits, so nothing is requested until one is chosen', async () => {
    const user = userEvent.setup();
    mockVisits = [];
    renderPage();

    await user.click(screen.getByRole('button', { name: /Medical Record/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Download Archive' }));

    expect(screen.getByTestId(rangeIds.fromInput)).toHaveValue('');
    expect(screen.getByTestId(rangeIds.confirmButton)).toBeDisabled();
    expect(mockDownloadMedicalRecord).not.toHaveBeenCalled();
  });

  it('keeps the date range open with the reason when the archive would be empty', async () => {
    const user = userEvent.setup();
    mockDownloadMedicalRecord.mockRejectedValue(INVALID_INPUT_ERROR(NO_MEDICAL_RECORDS_IN_RANGE_MESSAGE));
    renderPage();

    await user.click(screen.getByRole('button', { name: /Medical Record/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Download Archive' }));
    await user.click(screen.getByTestId(rangeIds.confirmButton));

    expect(await screen.findByTestId(rangeIds.message)).toHaveTextContent(NO_MEDICAL_RECORDS_IN_RANGE_MESSAGE);
    expect(screen.getByTestId(rangeIds.root)).toBeInTheDocument();
  });

  it('faxes the predefined range of the record from the Medical Record menu', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Medical Record/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Send as Fax' }));

    expect(mockOpen).not.toHaveBeenCalled();
    expect(screen.getByTestId(rangeIds.confirmButton)).toHaveTextContent('Send as Fax');

    await user.click(screen.getByTestId(rangeIds.confirmButton));

    expect(mockGetFaxPacketPreview).toHaveBeenCalledWith({
      medicalRecord: { patientId: PATIENT_ID, dateRange: PREDEFINED_RANGE },
    });
    expect(lastSource()).toEqual({ type: 'medical-record', patientId: PATIENT_ID, dateRange: PREDEFINED_RANGE });
    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(mockDownloadMedicalRecord).not.toHaveBeenCalled();
    // The whole record is one packet, so no visit picker is offered.
    expect(screen.getByTestId('fax-dialog')).not.toHaveTextContent('04/11/2026');
  });

  it('faxes only the chosen range of the record', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Medical Record/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Send as Fax' }));
    await user.click(screen.getByTestId(rangeIds.toInput));
    await user.keyboard('{Backspace}');
    await user.keyboard('06302026');
    await user.click(screen.getByTestId(rangeIds.confirmButton));

    const chosenRange = { from: PREDEFINED_RANGE.from, to: DateTime.local(2026, 6, 30).endOf('day').toISO() };
    expect(mockGetFaxPacketPreview).toHaveBeenCalledTimes(1);
    expect(mockGetFaxPacketPreview).toHaveBeenCalledWith({
      medicalRecord: { patientId: PATIENT_ID, dateRange: chosenRange },
    });
    expect(lastSource()).toEqual({ type: 'medical-record', patientId: PATIENT_ID, dateRange: chosenRange });
  });

  it('does not open the fax step when the range holds no records', async () => {
    const user = userEvent.setup();
    mockGetFaxPacketPreview.mockResolvedValue({ documents: [], hasSavedPcp: false, documentCount: 0 });
    renderPage();

    await user.click(screen.getByRole('button', { name: /Medical Record/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Send as Fax' }));
    await user.click(screen.getByTestId(rangeIds.confirmButton));

    expect(await screen.findByTestId(rangeIds.message)).toHaveTextContent(NO_MEDICAL_RECORDS_IN_RANGE_MESSAGE);
    expect(mockOpen).not.toHaveBeenCalled();
    expect(lastSource()).toBeUndefined();
  });
});
