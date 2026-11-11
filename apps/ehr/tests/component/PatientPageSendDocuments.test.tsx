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
const RECORD_DATES = {
  earliest: DateTime.local(2026, 2, 20, 10).toUTC().toISO(),
  latest: DateTime.local(2026, 7, 2, 11).toUTC().toISO(),
};
const PREDEFINED_RANGE = { from: DateTime.local(2026, 2, 20).toISO(), to: DateTime.now().endOf('day').toISO() };

const mockUseMedicalRecordDateSpan = vi.fn();
const mockUseSendDocuments = vi.fn();
const mockOpen = vi.fn();
const mockDownloadMedicalRecord = vi.fn<(dateRange: unknown) => Promise<void>>();
const mockGetDocumentPacketPreview = vi.fn();

// The fax slice owns sending; this page's job is to hand it the right source and visit list.
vi.mock('src/features/send-documents/hooks/useSendDocuments', () => ({
  useSendDocuments: (source: unknown) => {
    mockUseSendDocuments(source);
    return { isOpen: false, open: mockOpen, close: vi.fn(), isSending: false };
  },
}));
vi.mock('src/features/send-documents/ui/SendDocumentsDialog', () => ({
  SendDocumentsDialog: ({ title, visits }: { title?: string; visits?: { label: string }[] }) => (
    <div data-testid="send-documents-dialog" data-title={title}>
      {visits?.map((visit) => <span key={visit.label}>{visit.label}</span>)}
    </div>
  ),
}));
vi.mock('src/hooks/useDownloadMedicalRecord', () => ({
  useDownloadMedicalRecord: () => ({ downloadMedicalRecord: mockDownloadMedicalRecord, isDownloading: false }),
}));
vi.mock('src/hooks/useMedicalRecordDateSpan', () => ({
  useMedicalRecordDateSpan: (patientId: string | undefined, enabled: boolean) => {
    mockUseMedicalRecordDateSpan(patientId, enabled);
    return { data: RECORD_DATES, isFetching: false, isError: false };
  },
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
  useOystehrAPIClient: () => ({ getDocumentPacketPreview: mockGetDocumentPacketPreview }),
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
const lastSource = (): any => mockUseSendDocuments.mock.calls.at(-1)?.[0];
const rangeIds = dataTestIds.medicalRecordDateRangeDialog;

describe('PatientPage fax actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDownloadMedicalRecord.mockResolvedValue();
    mockGetDocumentPacketPreview.mockResolvedValue({ documents: [], hasSavedPcp: false, documentCount: 3 });
  });

  it('sends the patient visits from Send Patient Docs', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Send Patient Docs/i }));

    expect(lastSource()).toEqual({
      type: 'visits',
      patientId: PATIENT_ID,
      appointmentIds: ['appointment-2', 'appointment-1'],
    });
    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('send-documents-dialog')).toHaveAttribute('data-title', 'Send Patient Docs');
    // Visits are offered in the office's own timezone, not the reader's.
    expect(screen.getByText('04/11/2026 09:30 AM ET')).toBeInTheDocument();
  });

  it('asks for a date range before downloading the archive, predefined from the earliest record to today', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Medical Record/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Download Archive' }));

    expect(mockDownloadMedicalRecord).not.toHaveBeenCalled();
    expect(screen.getByTestId(rangeIds.fromInput)).toHaveValue('02/20/2026');
    expect(screen.getByTestId(rangeIds.toInput)).toHaveValue(DateTime.now().toFormat('MM/dd/yyyy'));
    expect(screen.getByTestId(rangeIds.confirmButton)).toHaveTextContent('Download Archive');

    await user.click(screen.getByTestId(rangeIds.confirmButton));

    expect(mockDownloadMedicalRecord).toHaveBeenCalledWith(PREDEFINED_RANGE);
    expect(mockOpen).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId(rangeIds.root)).not.toBeInTheDocument());
  });

  it('asks for the record dates only while the range dialog is open', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(mockUseMedicalRecordDateSpan).toHaveBeenLastCalledWith(PATIENT_ID, false);

    await user.click(screen.getByRole('button', { name: /Medical Record/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Send by Fax or Email' }));

    expect(mockUseMedicalRecordDateSpan).toHaveBeenLastCalledWith(PATIENT_ID, true);
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
    await user.click(screen.getByRole('menuitem', { name: 'Send by Fax or Email' }));

    expect(mockOpen).not.toHaveBeenCalled();
    expect(screen.getByTestId(rangeIds.confirmButton)).toHaveTextContent('Send by Fax or Email');

    await user.click(screen.getByTestId(rangeIds.confirmButton));

    expect(mockGetDocumentPacketPreview).toHaveBeenCalledWith({
      medicalRecord: { patientId: PATIENT_ID, dateRange: PREDEFINED_RANGE },
    });
    expect(lastSource()).toEqual({ type: 'medical-record', patientId: PATIENT_ID, dateRange: PREDEFINED_RANGE });
    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(mockDownloadMedicalRecord).not.toHaveBeenCalled();
    // The whole record is one packet, so no visit picker is offered.
    expect(screen.getByTestId('send-documents-dialog')).not.toHaveTextContent('04/11/2026');
  });

  it('faxes only the chosen range of the record', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Medical Record/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Send by Fax or Email' }));
    await user.click(screen.getByTestId(rangeIds.toInput));
    await user.keyboard('{Backspace}');
    await user.keyboard('06302026');
    await user.click(screen.getByTestId(rangeIds.confirmButton));

    const chosenRange = { from: PREDEFINED_RANGE.from, to: DateTime.local(2026, 6, 30).endOf('day').toISO() };
    expect(mockGetDocumentPacketPreview).toHaveBeenCalledTimes(1);
    expect(mockGetDocumentPacketPreview).toHaveBeenCalledWith({
      medicalRecord: { patientId: PATIENT_ID, dateRange: chosenRange },
    });
    expect(lastSource()).toEqual({ type: 'medical-record', patientId: PATIENT_ID, dateRange: chosenRange });
  });

  it('does not open the fax step when the range holds no records', async () => {
    const user = userEvent.setup();
    mockGetDocumentPacketPreview.mockResolvedValue({ documents: [], hasSavedPcp: false, documentCount: 0 });
    renderPage();

    await user.click(screen.getByRole('button', { name: /Medical Record/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Send by Fax or Email' }));
    await user.click(screen.getByTestId(rangeIds.confirmButton));

    expect(await screen.findByTestId(rangeIds.message)).toHaveTextContent(NO_MEDICAL_RECORDS_IN_RANGE_MESSAGE);
    expect(mockOpen).not.toHaveBeenCalled();
    expect(lastSource()).toBeUndefined();
  });
});
