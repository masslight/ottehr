import { enqueueSnackbar } from 'notistack';
import { useCallback, useState } from 'react';
import { getPatientMedicalRecordZip } from 'src/api/api';
import { useApiClients } from './useAppClients';

export type UseDownloadMedicalRecordReturn = {
  downloadMedicalRecord: () => Promise<void>;
  isDownloading: boolean;
};

/**
 * Collects all of a patient's documents into a single zip (server-side) and
 * triggers a browser download of the resulting archive.
 */
export const useDownloadMedicalRecord = (patientId: string | undefined): UseDownloadMedicalRecordReturn => {
  const { oystehrZambda } = useApiClients();
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadMedicalRecord = useCallback(async (): Promise<void> => {
    if (!oystehrZambda) {
      enqueueSnackbar('Could not initialize the API client. Please try again.', { variant: 'error' });
      return;
    }
    if (!patientId) {
      enqueueSnackbar('Missing patient id.', { variant: 'error' });
      return;
    }

    setIsDownloading(true);
    try {
      const { downloadUrl, fileName, documentCount } = await getPatientMedicalRecordZip(oystehrZambda, { patientId });

      if (documentCount === 0 || !downloadUrl) {
        enqueueSnackbar('This patient has no documents to download.', { variant: 'info' });
        return;
      }

      const response = await fetch(downloadUrl, { headers: { 'Cache-Control': 'no-cache' } });
      if (!response.ok) {
        throw new Error(`Failed to download archive [${response.status}]`);
      }
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error(error);
      // Surface a specific server message when provided (e.g. record too large); otherwise a generic one.
      const message =
        (error as { message?: string })?.message || 'Failed to generate the medical record. Please try again.';
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setIsDownloading(false);
    }
  }, [oystehrZambda, patientId]);

  return { downloadMedicalRecord, isDownloading };
};
