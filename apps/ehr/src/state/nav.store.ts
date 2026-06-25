import { create } from 'zustand';

export type AppTab = 'Tracking Board' | 'Patients' | 'Admin' | 'Tasks' | 'Reports';

interface NavState {
  currentTab?: string;
}

export const useNavStore = create<NavState>()(() => ({
  currentTab: undefined,
}));
