import { create } from 'zustand';

interface DeletedFreeFormEncountersState {
  deletedIdsByPatient: Record<string, string[]>;
  markDeleted: (patientId: string, encounterId: string) => void;
}

export const useDeletedFreeFormEncountersStore = create<DeletedFreeFormEncountersState>()((set) => ({
  deletedIdsByPatient: {},
  markDeleted: (patientId, encounterId) =>
    set((state) => ({
      deletedIdsByPatient: {
        ...state.deletedIdsByPatient,
        [patientId]: [...(state.deletedIdsByPatient[patientId] ?? []), encounterId],
      },
    })),
}));
