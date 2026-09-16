import { GetPatientMedicalRecordOutput } from 'utils/lib/types/data/get-patient-medical-record.types';

export const EXPORT_STATUS_POLL_BUDGET_MS = 16 * 60_000;

const FAST_POLL_WINDOW_MS = 10_000;
const FAST_POLL_INTERVAL_MS = 2_000;
const STEADY_POLL_INTERVAL_MS = 10_000;

const EXPORT_STATUS_POLL_TIMEOUT_GRACE_MS = 5_000;

export const EXPORT_STATUS_POLL_TIMEOUT_MS = EXPORT_STATUS_POLL_BUDGET_MS + EXPORT_STATUS_POLL_TIMEOUT_GRACE_MS;

export const nextExportPollInterval = (elapsedMs: number): number | false => {
  if (elapsedMs >= EXPORT_STATUS_POLL_BUDGET_MS) return false;
  return elapsedMs < FAST_POLL_WINDOW_MS ? FAST_POLL_INTERVAL_MS : STEADY_POLL_INTERVAL_MS;
};

export const MEDICAL_RECORD_EXPORT_QUERY_KEY = 'medical-record-export-status';

const SNACKBAR_KEY_PREFIX = 'medical-record-export-';

export const exportSnackbarKey = (taskId: string): string => `${SNACKBAR_KEY_PREFIX}${taskId}`;

export const taskIdFromExportSnackbarKey = (key: unknown): string | undefined =>
  typeof key === 'string' && key.startsWith(SNACKBAR_KEY_PREFIX) ? key.slice(SNACKBAR_KEY_PREFIX.length) : undefined;

export const MEDICAL_RECORD_EXPORT_GENERIC_FAILURE = 'The medical record could not be processed. Please try again.';

export interface ExportOutcome {
  message: string;
  variant: 'success' | 'warning' | 'info' | 'error';
  download: boolean;
  offerDownload: boolean;
}

export const describeExportOutcome = (
  status: GetPatientMedicalRecordOutput,
  options: { resumed?: boolean } = {}
): ExportOutcome => {
  const skipped = status.skipped ?? 0;
  const resumed = options.resumed ?? false;
  const plural = (count: number): string => (count === 1 ? 'document' : 'documents');
  const deliver = { download: !resumed, offerDownload: resumed };

  if (status.status === 'failed') {
    return {
      message: status.error || MEDICAL_RECORD_EXPORT_GENERIC_FAILURE,
      variant: 'error',
      download: false,
      offerDownload: false,
    };
  }

  if (!status.downloadUrl) {
    if (skipped > 0) {
      return {
        message: `None of the ${skipped} ${plural(
          skipped
        )} in this record could be read, so there was nothing to download.`,
        variant: 'error',
        download: false,
        offerDownload: false,
      };
    }
    return {
      message: 'This patient has no documents to download.',
      variant: 'info',
      download: false,
      offerDownload: false,
    };
  }

  if (skipped > 0) {
    const attempted = (status.total ?? 0) + skipped;
    return {
      message: `Medical record ready, but ${skipped} of ${attempted} ${plural(
        attempted
      )} could not be read and were left out.`,
      variant: 'warning',
      ...deliver,
    };
  }

  return {
    message: resumed
      ? 'The medical record export you started is ready.'
      : 'Medical record ready — your download is starting.',
    variant: 'success',
    ...deliver,
  };
};

export const formatExportProgress = (processed: number | undefined, total: number | undefined): string => {
  if (!total) return 'Preparing…';
  return `${(processed ?? 0).toLocaleString()} of ${total.toLocaleString()} documents`;
};
