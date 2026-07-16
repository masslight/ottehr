import { CreateLabOrderParameters } from 'utils';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type CreateExternalLabOrderDraft = Partial<
  Omit<CreateLabOrderParameters, 'encounter' | 'orderingLocation'> & {
    orderingLocationId: string;
    hasNavigatedAway: boolean;
  }
>;

interface CreateExternalLabDraftState {
  draftsByEncounterId: Record<string, CreateExternalLabOrderDraft>;
  setDraft: (encounterId: string, draftData: CreateExternalLabOrderDraft) => void;
  clearDraft: (encounterId: string) => void;
  hasDraft: (encounterId: string) => boolean;
  getDraft: (encounterId: string) => CreateExternalLabOrderDraft;
}

export const useCreateExternalLabStore = create<CreateExternalLabDraftState>()(
  persist(
    (set, get) => ({
      draftsByEncounterId: {},
      setDraft: (encounterId, draftData) =>
        set((state) => ({
          draftsByEncounterId: {
            ...state.draftsByEncounterId,
            [encounterId]: { ...get().draftsByEncounterId[encounterId], ...draftData },
          },
        })),
      clearDraft: (encounterId) =>
        set((state) => {
          const updatedState = { ...state.draftsByEncounterId };
          delete updatedState[encounterId];
          return { draftsByEncounterId: updatedState };
        }),
      hasDraft: (encounterId) => !!get().draftsByEncounterId[encounterId],
      getDraft: (encounterId) => get().draftsByEncounterId[encounterId] ?? {},
    }),
    { name: 'create-external-lab-order-draft', storage: createJSONStorage(() => sessionStorage) }
  )
);
