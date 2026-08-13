import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const PATIENT_ID = '11111111-1111-1111-1111-111111111111';
const VISITS = [
  { appointmentId: 'appointment-1', dateTime: '2026-04-11T09:30:00.000-04:00', timezone: 'America/New_York' },
  { appointmentId: 'appointment-2', dateTime: '2026-07-02T11:30:00.000-04:00', timezone: 'America/New_York' },
];

const mockUseSendFax = vi.fn();
const mockOpen = vi.fn();
const mockDownloadMedicalRecord = vi.fn<() => Promise<void>>();

// The fax slice owns sending; this page's job is to hand it the right source and visit list.
vi.mock('src/features/fax', () => ({
  useSendFax: (source: unknown) => {
    mockUseSendFax(source);
    return { isOpen: false, open: mockOpen, close: vi.fn(), isSending: false, failures: [] };
  },
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
      appointmentIds: ['appointment-1', 'appointment-2'],
    });
    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('fax-dialog')).toHaveAttribute('data-title', 'Fax Patient Docs');
    // Visits are offered in the office's own timezone, not the reader's.
    expect(screen.getByText('04/11/2026 09:30 AM ET')).toBeInTheDocument();
  });

  it('offers Download Archive and Send as Fax for the medical record', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Medical Record/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Download Archive' }));

    expect(mockDownloadMedicalRecord).toHaveBeenCalledTimes(1);
    expect(mockOpen).not.toHaveBeenCalled();
  });

  it('faxes the whole record from the Medical Record menu', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Medical Record/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Send as Fax' }));

    expect(lastSource()).toEqual({ type: 'medical-record', patientId: PATIENT_ID });
    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(mockDownloadMedicalRecord).not.toHaveBeenCalled();
    // The whole record is one packet, so no visit picker is offered.
    expect(screen.getByTestId('fax-dialog')).not.toHaveTextContent('04/11/2026');
  });
});
