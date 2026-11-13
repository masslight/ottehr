import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const PATIENT_ID = '11111111-1111-1111-1111-111111111111';

const { visits, getOrCreateVisitLabel, printVisitLabel, enqueueSnackbar } = vi.hoisted(() => ({
  visits: { current: [] as { appointmentId: string; encounterId?: string }[] },
  enqueueSnackbar: vi.fn(),
  getOrCreateVisitLabel: vi.fn(),
  printVisitLabel: vi.fn(),
}));

vi.mock('src/features/send-documents/hooks/useSendDocuments', () => ({
  useSendDocuments: () => ({ isOpen: false, open: vi.fn(), close: vi.fn(), isSending: false }),
}));
vi.mock('src/features/send-documents/ui/SendDocumentsDialog', () => ({ SendDocumentsDialog: () => <div /> }));
vi.mock('src/hooks/useDownloadMedicalRecord', () => ({
  useDownloadMedicalRecord: () => ({ downloadMedicalRecord: vi.fn(), isDownloading: false }),
}));
vi.mock('src/hooks/useGetPatientVisitHistory', () => ({
  useGetPatientVisitHistory: () => ({
    data: { visits: visits.current, metadata: { totalCount: visits.current.length, sortDirection: 'desc' } },
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
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehr: undefined, oystehrZambda: {} }) }));
vi.mock('src/hooks/useEvolveUser', () => ({ default: () => ({ hasRole: () => true }) }));
vi.mock('../../src/layout/PageContainer', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('../../src/components/PatientEncountersGrid', () => ({ PatientEncountersGrid: () => <div /> }));
vi.mock('../../src/components/PatientLabsTab', () => ({ PatientLabsTab: () => <div /> }));
vi.mock('src/components/PatientInHouseLabsTab', () => ({ PatientInHouseLabsTab: () => <div /> }));
vi.mock('src/components/PatientRadiologyTab', () => ({ PatientRadiologyTab: () => <div /> }));
vi.mock('src/api/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('src/api/api')>()),
  getOrCreateVisitLabel,
}));
vi.mock('notistack', async (importOriginal) => ({
  ...(await importOriginal<typeof import('notistack')>()),
  enqueueSnackbar,
}));
vi.mock('src/features/visits/shared/hooks/usePrintVisitLabel', () => ({
  usePrintVisitLabel: () => ({ printVisitLabel }),
}));

import { usePrintEncounterLabel } from '../../src/features/visits/shared/hooks/usePrintEncounterLabel';
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

describe('PatientPage Print Label button', () => {
  beforeEach(() => {
    visits.current = [];
    getOrCreateVisitLabel.mockReset().mockResolvedValue([{ presignedURL: 'https://label.example/latest.pdf' }]);
    printVisitLabel.mockReset().mockResolvedValue(undefined);
  });

  it("prints the label of the patient's latest visit", async () => {
    visits.current = [
      { appointmentId: 'appointment-latest', encounterId: 'encounter-latest' },
      { appointmentId: 'appointment-earlier', encounterId: 'encounter-earlier' },
    ];
    renderPage();

    await userEvent.setup().click(screen.getByRole('button', { name: /Print Label/i }));

    expect(getOrCreateVisitLabel).toHaveBeenCalledWith(expect.anything(), { encounterId: 'encounter-latest' });
    expect(printVisitLabel).toHaveBeenCalledWith({
      pdfPresignedUrl: 'https://label.example/latest.pdf',
      encounterId: 'encounter-latest',
    });
  });

  it('is hidden when the patient has no visits', () => {
    visits.current = [];
    renderPage();

    expect(screen.queryByRole('button', { name: /Print Label/i })).not.toBeInTheDocument();
  });
});

describe('usePrintEncounterLabel', () => {
  beforeEach(() => {
    getOrCreateVisitLabel.mockReset();
    printVisitLabel.mockReset();
    enqueueSnackbar.mockReset();
  });

  it('clears an earlier failure once a label prints', async () => {
    getOrCreateVisitLabel.mockRejectedValueOnce(new Error('Network error'));
    getOrCreateVisitLabel.mockResolvedValueOnce([{ presignedURL: 'https://label.example/1.pdf' }]);
    printVisitLabel.mockResolvedValue(undefined);
    const { result } = renderHook(() => usePrintEncounterLabel());

    await act(async () => {
      await result.current.printEncounterLabel('encounter-1');
    });
    expect(result.current.isError).toBe(true);

    await act(async () => {
      await result.current.printEncounterLabel('encounter-1');
    });
    expect(result.current.isError).toBe(false);
    expect(printVisitLabel).toHaveBeenCalledTimes(1);
  });

  it('reports a failure and stops loading when the label cannot be created', async () => {
    getOrCreateVisitLabel.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => usePrintEncounterLabel());

    await act(async () => {
      await result.current.printEncounterLabel('encounter-1');
    });

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.stringContaining('Could not create the label'), {
      variant: 'error',
    });
    expect(result.current.isPrinting).toBe(false);
    expect(result.current.isError).toBe(true);
    expect(printVisitLabel).not.toHaveBeenCalled();
  });

  it('tells the user when the label cannot be printed', async () => {
    getOrCreateVisitLabel.mockResolvedValue([{ presignedURL: 'https://label.example/1.pdf' }]);
    printVisitLabel.mockRejectedValue(new Error('Failed to fetch label PDF: 403'));
    const { result } = renderHook(() => usePrintEncounterLabel());

    await act(async () => {
      await result.current.printEncounterLabel('encounter-1');
    });

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.stringContaining('Could not print the label'), {
      variant: 'error',
    });
    expect(result.current.isError).toBe(true);
  });
});
