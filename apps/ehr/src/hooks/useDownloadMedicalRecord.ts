import { useCallback } from 'react';
import { startMedicalRecordExport } from 'src/api/api';
import { MedicalRecordDateRange } from 'utils/lib/types/data/get-patient-medical-record.types';
import {
  selectWatchedExport,
  useMedicalRecordExportStore,
  watchExport,
} from '../features/medical-record-export/store/medicalRecordExport.store';
import { useApiClients } from './useAppClients';

export type UseDownloadMedicalRecordReturn = {
  downloadMedicalRecord: (dateRange: MedicalRecordDateRange) => Promise<void>;
  isDownloading: boolean;
};

export const useDownloadMedicalRecord = (patientId: string | undefined): UseDownloadMedicalRecordReturn => {
  const { oystehrZambda } = useApiClients();
  const watched = useMedicalRecordExportStore(selectWatchedExport(patientId));

  const downloadMedicalRecord = useCallback(
    async (dateRange: MedicalRecordDateRange): Promise<void> => {
      if (!oystehrZambda) {
        throw new Error('Could not initialize the API client. Please try again.');
      }
      if (!patientId) {
        throw new Error('Missing patient id.');
      }
      if (watched) return;

      const job = await startMedicalRecordExport(oystehrZambda, { patientId, dateRange });
      watchExport({ patientId, taskId: job.taskId });
    },
    [oystehrZambda, patientId, watched]
  );

  return { downloadMedicalRecord, isDownloading: Boolean(watched) };
};
