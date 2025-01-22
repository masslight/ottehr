import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PastVisitState {
  appointmentID?: string;
  appointmentDate?: string;
}

const PAST_VISIT_STATE_INITIAL: PastVisitState = {};

interface PastVisitActions {
  setState: (state: Partial<PastVisitState>) => void;
}

export const usePastVisitsStore = create<PastVisitState & PastVisitActions>()(
  persist((set) => ({ ...PAST_VISIT_STATE_INITIAL, setState: (state) => set({ ...state }) }), {
    name: 'past-visit-storage',
  })
);
