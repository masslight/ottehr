import { GetPatientMedicalRecordOutput } from 'utils/lib/types/data/get-patient-medical-record.types';

/** The worker cannot outlive the zambda's 900 s ceiling, so past this the job is not coming back. */
export const EXPORT_STATUS_POLL_BUDGET_MS = 16 * 60_000;

/** Polled quickly at first so a small chart feels instant, then at a steady rate for the long tail. */
const FAST_POLL_WINDOW_MS = 10_000;
const FAST_POLL_INTERVAL_MS = 2_000;
const STEADY_POLL_INTERVAL_MS = 10_000;

/** Grace added on top of the budget so the timeout never beats the final in-flight poll. */
const EXPORT_STATUS_POLL_TIMEOUT_GRACE_MS = 5_000;

/** Hard ceiling for the whole poll. Derived from the budget so the two cannot drift apart. */
export const EXPORT_STATUS_POLL_TIMEOUT_MS = EXPORT_STATUS_POLL_BUDGET_MS + EXPORT_STATUS_POLL_TIMEOUT_GRACE_MS;

/**
 * Delay before the next poll, or `false` to stop. Keyed on elapsed time, not poll count: React Query also
 * refetches on window focus, and those would walk a count-indexed schedule off its end with no time passing.
 */
export const nextExportPollInterval = (elapsedMs: number): number | false => {
  if (elapsedMs >= EXPORT_STATUS_POLL_BUDGET_MS) return false;
  return elapsedMs < FAST_POLL_WINDOW_MS ? FAST_POLL_INTERVAL_MS : STEADY_POLL_INTERVAL_MS;
};

export const MEDICAL_RECORD_EXPORT_QUERY_KEY = 'medical-record-export-status';

const SNACKBAR_KEY_PREFIX = 'medical-record-export-';

/**
 * The snackbar's key doubles as how its content finds the job. notistack's `VariantOverrides` are global,
 * so declaring a required extra prop there makes `enqueueSnackbar` demand it at every call site whose
 * `variant` is a computed union — including unrelated ones.
 */
export const exportSnackbarKey = (taskId: string): string => `${SNACKBAR_KEY_PREFIX}${taskId}`;

export const taskIdFromExportSnackbarKey = (key: unknown): string | undefined =>
  typeof key === 'string' && key.startsWith(SNACKBAR_KEY_PREFIX) ? key.slice(SNACKBAR_KEY_PREFIX.length) : undefined;

/** Shown for any failure the server wrote no message for. Phrased to match the fax feature's equivalent. */
export const MEDICAL_RECORD_EXPORT_GENERIC_FAILURE = 'The medical record could not be processed. Please try again.';

export interface ExportOutcome {
  message: string;
  variant: 'success' | 'warning' | 'info' | 'error';
  /** Start the download now, because the user is waiting on the click that began this. */
  download: boolean;
  /** Offer it as an action instead — for a job re-adopted after a reload, where a download would startle. */
  offerDownload: boolean;
}

/**
 * What to tell the user about a finished export. Unreadable documents are dropped before the archive's
 * length is committed, so an export can succeed while incomplete — reporting that as a clean success would
 * hand someone a record with silent holes in it.
 */
export const describeExportOutcome = (
  status: GetPatientMedicalRecordOutput,
  options: { resumed?: boolean } = {}
): ExportOutcome => {
  const skipped = status.skipped ?? 0;
  const resumed = options.resumed ?? false;
  const plural = (count: number): string => (count === 1 ? 'document' : 'documents');
  // A resumed job is announced and offered; one the user is still waiting on is simply delivered.
  const deliver = { download: !resumed, offerDownload: resumed };

  if (status.status === 'failed') {
    return {
      // `status.error` is only ever a message the worker authored; an internal failure arrives with none.
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

/** "142 of 1,082 documents", or a neutral label until the worker has published a total. */
export const formatExportProgress = (processed: number | undefined, total: number | undefined): string => {
  if (!total) return 'Preparing…';
  return `${(processed ?? 0).toLocaleString()} of ${total.toLocaleString()} documents`;
};
