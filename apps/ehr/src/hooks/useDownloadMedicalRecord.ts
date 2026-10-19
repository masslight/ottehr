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
  downloadMedicalRecord: () => Promise<void>;
  isDownloading: boolean;
};

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
    if (watched) return;

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
