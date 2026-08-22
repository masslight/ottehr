import {
  GetPatientMedicalRecordOutput,
  MedicalRecordExportStatus,
} from 'utils/lib/types/data/get-patient-medical-record.types';
import { create } from 'zustand';
import { readAllStoredExportTaskIds, writeStoredExportTaskId } from '../model/medicalRecordExportPolling';

/**
 * One export being watched. In a store rather than the patient page's state because the archive keeps
 * building after the user navigates away, and a watcher that unmounts with the page stops polling.
 */
export interface WatchedExport {
  patientId: string;
  taskId: string;
  /** When this watch began, not necessarily when the export did; the cadence and give-up bound use it. */
  startedAt: number;
  /** Rebuilt from storage on a page load rather than started by a click, so its archive is offered, not pushed. */
  resumed: boolean;
  status?: MedicalRecordExportStatus;
  processed?: number;
  total?: number;
  skipped?: number;
  fileName?: string;
  downloadUrl?: string;
  error?: string;
}

interface MedicalRecordExportState {
  /** Keyed by patient, matching the backend's one-export-per-patient rule. */
  exports: Record<string, WatchedExport>;
}

export const useMedicalRecordExportStore = create<MedicalRecordExportState>()(() => ({ exports: {} }));

export const watchExport = (input: { patientId: string; taskId: string; resumed?: boolean }): void => {
  const { patientId, taskId, resumed = false } = input;
  useMedicalRecordExportStore.setState((state) => ({
    exports: {
      ...state.exports,
      [patientId]: { patientId, taskId, startedAt: Date.now(), resumed, status: 'requested' },
    },
  }));
  if (!resumed) writeStoredExportTaskId(patientId, taskId);
};

/** Folds a poll response into the watched job, so the progress UI reads it from one place. */
export const recordExportStatus = (patientId: string, status: GetPatientMedicalRecordOutput): void => {
  useMedicalRecordExportStore.setState((state) => {
    const existing = state.exports[patientId];
    if (!existing) return state;
    return {
      exports: {
        ...state.exports,
        [patientId]: {
          ...existing,
          status: status.status,
          processed: status.processed,
          total: status.total,
          skipped: status.skipped,
          fileName: status.fileName,
          downloadUrl: status.downloadUrl,
          error: status.error,
        },
      },
    };
  });
};

export const stopWatchingExport = (patientId: string): void => {
  useMedicalRecordExportStore.setState((state) => {
    if (!state.exports[patientId]) return state;
    const next = { ...state.exports };
    delete next[patientId];
    return { exports: next };
  });
  writeStoredExportTaskId(patientId, undefined);
};

/** Called once on watcher mount — the only moment a reload is distinguishable from navigation. */
export const resumeStoredExports = (): void => {
  for (const { patientId, taskId } of readAllStoredExportTaskIds()) {
    if (useMedicalRecordExportStore.getState().exports[patientId]) continue;
    watchExport({ patientId, taskId, resumed: true });
  }
};

export const selectWatchedExport =
  (patientId: string | undefined) =>
  (state: MedicalRecordExportState): WatchedExport | undefined =>
    patientId ? state.exports[patientId] : undefined;

/** By task, not patient: the snackbar is per-job and identifies itself by its own key. */
export const selectExportByTaskId =
  (taskId: string) =>
  (state: MedicalRecordExportState): WatchedExport | undefined =>
    Object.values(state.exports).find((job) => job.taskId === taskId);
