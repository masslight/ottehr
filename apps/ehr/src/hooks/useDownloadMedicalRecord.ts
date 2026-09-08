import { enqueueSnackbar } from 'notistack';
import { useCallback } from 'react';
import { startMedicalRecordExport } from 'src/api/api';
import {
  selectWatchedExport,
  useMedicalRecordExportStore,
  watchExport,
} from '../features/medical-record-export/store/medicalRecordExport.store';
import { useApiClients } from './useAppClients';

export type UseDownloadMedicalRecordReturn = {
  /** Queues the export (or re-attaches to one already running for this patient). */
  downloadMedicalRecord: () => Promise<void>;
  isDownloading: boolean;
};

/**
 * Starts a background medical-record export and reports whether one is running.
 *
 * Deliberately thin: the polling, the progress readout and the finished message all belong to
 * `MedicalRecordExportWatcher`, which is mounted outside the router. Owning them here would tie them to
 * the patient page's lifetime, and the archive keeps building long after the user has moved on.
 */
export const useDownloadMedicalRecord = (patientId: string | undefined): UseDownloadMedicalRecordReturn => {
  const { oystehrZambda } = useApiClients();
  const watched = useMedicalRecordExportStore(selectWatchedExport(patientId));

  const downloadMedicalRecord = useCallback(async (): Promise<void> => {
    if (!oystehrZambda) {
      enqueueSnackbar('Could not initialize the API client. Please try again.', { variant: 'error' });
      return;
    }
    if (!patientId) {
      enqueueSnackbar('Missing patient id.', { variant: 'error' });
      return;
    }
    if (watched) return; // Already running for this patient.

    try {
      const job = await startMedicalRecordExport(oystehrZambda, { patientId });
      watchExport({ patientId, taskId: job.taskId });
    } catch (error) {
      console.error(error);
      const message =
        (error as { message?: string })?.message || 'Failed to generate the medical record. Please try again.';
      enqueueSnackbar(message, { variant: 'error' });
    }
  }, [oystehrZambda, patientId, watched]);

  return { downloadMedicalRecord, isDownloading: Boolean(watched) };
};
