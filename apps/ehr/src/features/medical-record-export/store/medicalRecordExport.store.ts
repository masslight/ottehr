import {
  GetPatientMedicalRecordOutput,
  MedicalRecordExportStatus,
} from 'utils/lib/types/data/get-patient-medical-record.types';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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

export const MEDICAL_RECORD_EXPORT_STORE_NAME = 'medical-record-export';

/**
 * Persisted to `sessionStorage` so a page reload can re-adopt an export rather than orphan it, the same
 * way the order drafts do it. Only the identity of each job is kept: progress is re-read from the Task on
 * the next poll, and `resumed` is set on rehydrate so a re-adopted archive is offered rather than pushed.
 */
export const useMedicalRecordExportStore = create<MedicalRecordExportState>()(
  persist(() => ({ exports: {} }) as MedicalRecordExportState, {
    name: MEDICAL_RECORD_EXPORT_STORE_NAME,
    storage: createJSONStorage(() => sessionStorage),
    partialize: (state) => ({
      exports: Object.fromEntries(
        Object.entries(state.exports).map(([patientId, job]) => [
          patientId,
          { patientId, taskId: job.taskId, startedAt: job.startedAt, resumed: job.resumed },
        ])
      ),
    }),
    merge: (persisted, current) => {
      const stored = (persisted as MedicalRecordExportState | undefined)?.exports ?? {};
      return {
        ...current,
        // A stored job was started by an earlier page load, so its clock restarts and its archive is
        // offered rather than downloaded unprompted.
        exports: Object.fromEntries(
          Object.entries(stored).map(([patientId, job]) => [
            patientId,
            { ...job, resumed: true, startedAt: Date.now(), status: 'requested' as MedicalRecordExportStatus },
          ])
        ),
      };
    },
  })
);

export const watchExport = (input: { patientId: string; taskId: string; resumed?: boolean }): void => {
  const { patientId, taskId, resumed = false } = input;
  useMedicalRecordExportStore.setState((state) => ({
    exports: {
      ...state.exports,
      [patientId]: { patientId, taskId, startedAt: Date.now(), resumed, status: 'requested' },
    },
  }));
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
};

/**
 * `sessionStorage` survives the same-tab logout → Auth0 round-trip.
 */
export const clearPersistedExports = (): void => {
  useMedicalRecordExportStore.setState({ exports: {} });
  void useMedicalRecordExportStore.persist.clearStorage();
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
