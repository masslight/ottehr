import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SnackbarProvider } from 'notistack';
import { GetPatientMedicalRecordOutput } from 'utils/lib/types/data/get-patient-medical-record.types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const PATIENT_ID = '11111111-1111-1111-1111-111111111111';
const TASK_ID = 'task-abc';

const mockGetStatus =
  vi.fn<(client: unknown, params: { taskId: string; patientId: string }) => Promise<GetPatientMedicalRecordOutput>>();

vi.mock('src/api/api', () => ({
  getMedicalRecordExportStatus: (client: unknown, params: { taskId: string; patientId: string }) =>
    mockGetStatus(client, params),
  startMedicalRecordExport: vi.fn(),
}));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {} }) }));

const { MedicalRecordExportWatcher } = await import(
  '../../src/features/medical-record-export/components/MedicalRecordExportWatcher'
);
const { MedicalRecordExportSnackbar } = await import(
  '../../src/features/medical-record-export/components/MedicalRecordExportSnackbar'
);
const { ExportProgressMessage } = await import(
  '../../src/features/medical-record-export/components/ExportProgressMessage'
);
const { MEDICAL_RECORD_EXPORT_STORE_NAME, recordExportStatus, useMedicalRecordExportStore, watchExport } = await import(
  '../../src/features/medical-record-export/store/medicalRecordExport.store'
);
const { MEDICAL_RECORD_EXPORT_GENERIC_FAILURE } = await import(
  '../../src/features/medical-record-export/model/medicalRecordExportPolling'
);

/**
 * A page reload: the store's memory is gone but `sessionStorage` survives. Written this way rather than
 * seeding storage by hand so the test goes through the same persist round-trip the app does.
 */
const simulateReload = async (): Promise<void> => {
  const persisted = window.sessionStorage.getItem(MEDICAL_RECORD_EXPORT_STORE_NAME);
  useMedicalRecordExportStore.setState({ exports: {} });
  if (persisted) window.sessionStorage.setItem(MEDICAL_RECORD_EXPORT_STORE_NAME, persisted);
  await useMedicalRecordExportStore.persist.rehydrate();
};

const completed = (overrides: Partial<GetPatientMedicalRecordOutput> = {}): GetPatientMedicalRecordOutput => ({
  taskId: TASK_ID,
  status: 'completed',
  processed: 9,
  total: 9,
  fileName: 'medical_record_doe_jane.zip',
  downloadUrl: 'https://signed.example/record.zip',
  ...overrides,
});

/**
 * The watcher is mounted on its own, with no patient page anywhere in the tree — which is the situation
 * it exists for: the user clicked Download Archive and then navigated somewhere else.
 */
const renderWatcher = (): ReturnType<typeof render> =>
  render(
    // The watcher sets its own `retry`; only the backoff is flattened here, so the failure path does not
    // spend seven real seconds backing off inside a test.
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })}>
      {/* The variant is registered exactly as App.tsx does it, so these tests exercise the real wiring
          rather than a stand-in for it. */}
      <SnackbarProvider maxSnack={5} Components={{ medicalRecordExport: MedicalRecordExportSnackbar }}>
        <MedicalRecordExportWatcher />
      </SnackbarProvider>
    </QueryClientProvider>
  );

describe('medical record export watcher', () => {
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    useMedicalRecordExportStore.setState({ exports: {} });
    window.sessionStorage.clear();
    mockGetStatus.mockReset();
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when nothing is being exported', () => {
    it('costs nothing: no request, no timer, no snackbar', async () => {
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

      renderWatcher();
      await Promise.resolve();

      expect(mockGetStatus).not.toHaveBeenCalled();
      expect(setTimeoutSpy).not.toHaveBeenCalled();
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  describe('progress readout', () => {
    it('reads as preparing until the worker publishes a total', () => {
      watchExport({ patientId: PATIENT_ID, taskId: TASK_ID });
      render(<ExportProgressMessage taskId={TASK_ID} />);

      expect(screen.getByText(/Preparing medical record — Preparing…/)).toBeInTheDocument();
      // Indeterminate: inventing a percentage before the size pass finishes would be a lie.
      expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
    });

    it('updates in place as the count advances, without being re-created', async () => {
      watchExport({ patientId: PATIENT_ID, taskId: TASK_ID });
      render(<ExportProgressMessage taskId={TASK_ID} />);

      recordExportStatus(PATIENT_ID, { taskId: TASK_ID, status: 'in-progress', processed: 142, total: 1082 });
      await waitFor(() => expect(screen.getByText(/142 of 1,082 documents/)).toBeInTheDocument());
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '13');

      recordExportStatus(PATIENT_ID, { taskId: TASK_ID, status: 'in-progress', processed: 900, total: 1082 });
      await waitFor(() => expect(screen.getByText(/900 of 1,082 documents/)).toBeInTheDocument());
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '83');
    });

    it('renders through notistack as a standard variant, not as a bespoke card', async () => {
      // Guards the consistency fix: the progress snackbar must come out of notistack's own
      // MaterialDesignContent, so it matches every other snackbar in the app.
      mockGetStatus.mockResolvedValue({ taskId: TASK_ID, status: 'in-progress', processed: 3, total: 12 });
      watchExport({ patientId: PATIENT_ID, taskId: TASK_ID });

      const { container } = renderWatcher();

      await waitFor(() => expect(screen.getByText(/3 of 12 documents/)).toBeInTheDocument());
      expect(container.querySelector('.notistack-MuiContent-info')).toBeTruthy();
    });

    it('shows one snackbar for a starting export, not two saying the same thing', async () => {
      mockGetStatus.mockResolvedValue({ taskId: TASK_ID, status: 'requested' });
      watchExport({ patientId: PATIENT_ID, taskId: TASK_ID });

      const { container } = renderWatcher();

      await waitFor(() => expect(screen.getByText(/Preparing medical record/)).toBeInTheDocument());
      expect(container.querySelectorAll('.notistack-Snackbar')).toHaveLength(1);
    });
  });

  describe('the give-up backstop', () => {
    it('is not rebuilt on every store update while a job is watched', async () => {
      // Only correct because the delay is computed from an absolute deadline; a timer rebuilt per tick
      // would postpone the deadline forever the moment anyone simplified that to a flat budget.
      mockGetStatus.mockResolvedValue({ taskId: TASK_ID, status: 'in-progress', processed: 1, total: 50 });
      watchExport({ patientId: PATIENT_ID, taskId: TASK_ID });

      // React Query schedules its own short timers; only the long ones are this backstop.
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
      const backstops = (): number =>
        setTimeoutSpy.mock.calls.filter((call) => ((call[1] as number) ?? 0) > 60_000).length;

      renderWatcher();
      await waitFor(() => expect(backstops()).toBe(1));

      for (const processed of [5, 12, 30]) {
        await act(async () => {
          recordExportStatus(PATIENT_ID, { taskId: TASK_ID, status: 'in-progress', processed, total: 50 });
        });
      }

      expect(backstops()).toBe(1);
    });
  });

  describe('completion while the user is elsewhere', () => {
    it('announces the finished export and starts the download with no patient page mounted', async () => {
      mockGetStatus.mockResolvedValue(completed());
      watchExport({ patientId: PATIENT_ID, taskId: TASK_ID });

      renderWatcher();

      await waitFor(() => expect(screen.getByText(/your download is starting/i)).toBeInTheDocument());
      expect(clickSpy).toHaveBeenCalledTimes(1);
      // Resolved jobs stop being watched, so nothing polls or re-announces them.
      await waitFor(() => expect(useMedicalRecordExportStore.getState().exports[PATIENT_ID]).toBeUndefined());
      expect(window.sessionStorage.getItem(MEDICAL_RECORD_EXPORT_STORE_NAME) ?? '').not.toContain(TASK_ID);
    });

    it('polls with the patient id, so the server can refuse another chart’s export', async () => {
      mockGetStatus.mockResolvedValue(completed());
      watchExport({ patientId: PATIENT_ID, taskId: TASK_ID });

      renderWatcher();

      await waitFor(() => expect(mockGetStatus).toHaveBeenCalled());
      expect(mockGetStatus.mock.calls[0][1]).toEqual({ taskId: TASK_ID, patientId: PATIENT_ID });
    });

    it('warns, rather than reporting a clean success, when documents were left out', async () => {
      mockGetStatus.mockResolvedValue(completed({ total: 7, processed: 7, skipped: 3 }));
      watchExport({ patientId: PATIENT_ID, taskId: TASK_ID });

      renderWatcher();

      await waitFor(() =>
        expect(screen.getByText(/3 of 10 documents could not be read and were left out/i)).toBeInTheDocument()
      );
      // Still delivered: an incomplete record is more use than none, as long as it is labelled.
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('reports a chart whose documents were all unreadable as such', async () => {
      mockGetStatus.mockResolvedValue(completed({ total: 0, processed: 0, skipped: 4, downloadUrl: undefined }));
      watchExport({ patientId: PATIENT_ID, taskId: TASK_ID });

      renderWatcher();

      await waitFor(() => expect(screen.getByText(/none of the 4 documents/i)).toBeInTheDocument());
      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('surfaces a failure message the server wrote for the user', async () => {
      mockGetStatus.mockResolvedValue({
        taskId: TASK_ID,
        status: 'failed',
        error: 'This record is too large to export as one file.',
      });
      watchExport({ patientId: PATIENT_ID, taskId: TASK_ID });

      renderWatcher();

      await waitFor(() =>
        expect(screen.getByText('This record is too large to export as one file.')).toBeInTheDocument()
      );
      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('reports an internal failure generically, the way outbound-fax does', async () => {
      // The server sends no message for an internal error, so the cause never reaches the user.
      mockGetStatus.mockResolvedValue({ taskId: TASK_ID, status: 'failed' });
      watchExport({ patientId: PATIENT_ID, taskId: TASK_ID });

      renderWatcher();

      await waitFor(() => expect(screen.getByText(MEDICAL_RECORD_EXPORT_GENERIC_FAILURE)).toBeInTheDocument());
      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('gives up loudly when the poll keeps failing', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      mockGetStatus.mockRejectedValue(new Error('gateway blew up'));
      watchExport({ patientId: PATIENT_ID, taskId: TASK_ID });

      renderWatcher();

      await waitFor(() => expect(screen.getByText(/lost track of the medical record export/i)).toBeInTheDocument());
      expect(useMedicalRecordExportStore.getState().exports[PATIENT_ID]).toBeUndefined();
    });
  });

  describe('an export re-adopted after a page reload', () => {
    it('offers the archive instead of downloading something nobody just asked for', async () => {
      mockGetStatus.mockResolvedValue(completed());
      watchExport({ patientId: PATIENT_ID, taskId: TASK_ID });
      await simulateReload();

      renderWatcher();

      await waitFor(() =>
        expect(screen.getByText(/the medical record export you started is ready/i)).toBeInTheDocument()
      );
      // The whole point: no download starts on its own an unknown amount of time later.
      expect(clickSpy).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole('button', { name: 'Download' }));
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('picks the export back up from storage across a reload', async () => {
      mockGetStatus.mockResolvedValue({ taskId: TASK_ID, status: 'in-progress', processed: 4, total: 20 });
      watchExport({ patientId: PATIENT_ID, taskId: TASK_ID });
      expect(useMedicalRecordExportStore.getState().exports[PATIENT_ID]?.resumed).toBe(false);

      await simulateReload();

      const readopted = useMedicalRecordExportStore.getState().exports[PATIENT_ID];
      expect(readopted?.taskId).toBe(TASK_ID);
      expect(readopted?.resumed).toBe(true);

      renderWatcher();
      await waitFor(() => expect(mockGetStatus).toHaveBeenCalled());
    });
  });
});
