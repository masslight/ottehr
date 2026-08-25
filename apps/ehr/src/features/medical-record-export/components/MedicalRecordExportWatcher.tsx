import CloseIcon from '@mui/icons-material/Close';
import { Button, IconButton } from '@mui/material';
import { useQueries } from '@tanstack/react-query';
import { closeSnackbar, enqueueSnackbar } from 'notistack';
import { useCallback, useEffect, useRef } from 'react';
import { getMedicalRecordExportStatus } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  GetPatientMedicalRecordOutput,
  isTerminalMedicalRecordExportStatus,
} from 'utils/lib/types/data/get-patient-medical-record.types';
import {
  describeExportOutcome,
  EXPORT_STATUS_POLL_BUDGET_MS,
  exportSnackbarKey,
  MEDICAL_RECORD_EXPORT_QUERY_KEY,
  nextExportPollInterval,
} from '../model/medicalRecordExportPolling';
import {
  recordExportStatus,
  stopWatchingExport,
  useMedicalRecordExportStore,
  WatchedExport,
} from '../store/medicalRecordExport.store';

/** Consecutive poll failures tolerated before the job is declared lost. */
const POLL_RETRIES = 3;

const startDownload = (downloadUrl: string, fileName: string | undefined): void => {
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = fileName ?? 'medical_record.zip';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};

/**
 * Polls every export in flight for as long as the app is open. Mounted once outside the router.
 * Renders nothing; its output is the progress snackbar and the finished message.
 */
export const MedicalRecordExportWatcher = (): null => {
  const { oystehrZambda } = useApiClients();
  const exports = useMedicalRecordExportStore((state) => state.exports);
  // Resolved exactly once per task, since a query can settle more than once.
  const handledRef = useRef<Set<string>>(new Set());
  const snackbarShownRef = useRef<Set<string>>(new Set());

  const settle = useCallback((job: WatchedExport, handle: () => void): void => {
    if (handledRef.current.has(job.taskId)) return;
    handledRef.current.add(job.taskId);
    closeSnackbar(exportSnackbarKey(job.taskId));
    handle();
    stopWatchingExport(job.patientId);
  }, []);

  const finish = useCallback(
    (job: WatchedExport, status: GetPatientMedicalRecordOutput): void => {
      settle(job, () => {
        const outcome = describeExportOutcome(status, { resumed: job.resumed });
        if (outcome.download && status.downloadUrl) {
          startDownload(status.downloadUrl, status.fileName);
        }

        enqueueSnackbar(outcome.message, {
          variant: outcome.variant,
          // An offered archive needs its message to stay up long enough to act on.
          persist: outcome.offerDownload,
          action:
            outcome.offerDownload && status.downloadUrl
              ? (key) => (
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => {
                      startDownload(status.downloadUrl as string, status.fileName);
                      closeSnackbar(key);
                    }}
                  >
                    Download
                  </Button>
                )
              : undefined,
        });
      });
    },
    [settle]
  );

  const abandon = useCallback(
    (job: WatchedExport, message: string): void => {
      settle(job, () => enqueueSnackbar(message, { variant: 'error' }));
    },
    [settle]
  );

  const watched = Object.values(exports);
  // Stable across renders that did not change which exports are being watched.
  const watchedKey = watched.map((job) => job.taskId).join('|');

  const results = useQueries({
    queries: watched.map((job) => ({
      queryKey: [MEDICAL_RECORD_EXPORT_QUERY_KEY, job.taskId],
      queryFn: () => getMedicalRecordExportStatus(oystehrZambda!, { taskId: job.taskId, patientId: job.patientId }),
      enabled: Boolean(oystehrZambda),
      refetchInterval: (query: { state: { data?: GetPatientMedicalRecordOutput } }) => {
        if (query.state.data && isTerminalMedicalRecordExportStatus(query.state.data.status)) return false;
        return nextExportPollInterval(Date.now() - job.startedAt);
      },
      // Otherwise the poll stalls whenever the tab loses focus, which is most of this job's life.
      refetchIntervalInBackground: true,
      retry: POLL_RETRIES,
      gcTime: 0,
    })),
    combine: (queryResults) =>
      queryResults.map((result, index) => ({
        job: watched[index],
        data: result.data,
        isError: result.isError,
        error: result.error,
      })),
  });

  // Once per job, including a resumed one. The snackbar reads progress from the store, so it keeps
  // updating without this effect running again.
  useEffect(() => {
    for (const job of Object.values(useMedicalRecordExportStore.getState().exports)) {
      if (snackbarShownRef.current.has(job.taskId)) continue;
      snackbarShownRef.current.add(job.taskId);
      const key = exportSnackbarKey(job.taskId);
      enqueueSnackbar('', {
        key,
        persist: true,
        variant: 'medicalRecordExport',
        // Hiding the readout does not stop the export, and the finished message still arrives.
        action: (
          <IconButton size="small" color="inherit" aria-label="Hide export progress" onClick={() => closeSnackbar(key)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        ),
      });
    }
  }, [watchedKey]);

  // A timer rather than a check per poll: the schedule itself stops at the budget, so a job that never
  // reports would take its last poll and never be looked at again.
  useEffect(() => {
    const timers = watched.map((job) =>
      setTimeout(
        () => abandon(job, "We couldn't confirm the medical record export finished. Please try again."),
        Math.max(0, job.startedAt + EXPORT_STATUS_POLL_BUDGET_MS - Date.now())
      )
    );
    return () => timers.forEach(clearTimeout);
  }, [watchedKey, watched, abandon]);

  useEffect(() => {
    for (const { job, data, isError, error } of results) {
      if (!job || handledRef.current.has(job.taskId)) continue;

      if (isError) {
        console.error(error);
        abandon(
          job,
          'Lost track of the medical record export. It may still be running — try again in a moment to pick it back up.'
        );
        continue;
      }

      if (!data) continue;
      recordExportStatus(job.patientId, data);
      if (isTerminalMedicalRecordExportStatus(data.status)) finish(job, data);
    }
  }, [results, finish, abandon]);

  return null;
};
