import {
  GetPatientMedicalRecordOutput,
  MedicalRecordExportStatus,
} from 'utils/lib/types/data/get-patient-medical-record.types';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface WatchedExport {
  patientId: string;
  taskId: string;
  startedAt: number;
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
  exports: Record<string, WatchedExport>;
}

export const MEDICAL_RECORD_EXPORT_STORE_NAME = 'medical-record-export';

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

export const clearPersistedExports = (): void => {
  useMedicalRecordExportStore.setState({ exports: {} });
  void useMedicalRecordExportStore.persist.clearStorage();
};

export const selectWatchedExport =
  (patientId: string | undefined) =>
  (state: MedicalRecordExportState): WatchedExport | undefined =>
    patientId ? state.exports[patientId] : undefined;

export const selectExportByTaskId =
  (taskId: string) =>
  (state: MedicalRecordExportState): WatchedExport | undefined =>
    Object.values(state.exports).find((job) => job.taskId === taskId);
